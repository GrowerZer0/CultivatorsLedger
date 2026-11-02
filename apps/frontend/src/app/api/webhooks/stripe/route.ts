import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ─── Initial checkout ──────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("checkout.session.completed: missing userId in metadata");
          // Return 200 — retrying won't fix missing metadata
          return NextResponse.json({ received: true });
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        await db.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            subscriptionTier: "GROWER",
            subscriptionStatus: subscription.status,
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });
        break;
      }

      // ─── Subscription lifecycle ────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const user = await db.user.findFirst({
          where: { stripeCustomerId: subscription.customer as string },
          select: { id: true },
        });
        if (!user) {
          // User deleted while subscription active — log, don't retry
          console.error(
            `subscription event: no user for customer ${subscription.customer}`,
          );
          break;
        }

        const isPaidAccess =
          subscription.status === "active" || subscription.status === "trialing";

        // Only overwrite trialEndsAt if the sub is still trialing.
        // After conversion to paid, trial_end is null and we don't want
        // to erase the historical record.
        const trialEndsAtUpdate =
          subscription.status === "trialing" && subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : undefined;

        await db.user.update({
          where: { id: user.id },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            subscriptionTier: isPaidAccess ? "GROWER" : "FREE",
            ...(trialEndsAtUpdate !== undefined
              ? { trialEndsAt: trialEndsAtUpdate }
              : {}),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const user = await db.user.findFirst({
          where: { stripeCustomerId: subscription.customer as string },
          select: { id: true },
        });
        if (!user) {
          console.error(
            `subscription.deleted: no user for customer ${subscription.customer}`,
          );
          break;
        }

        await db.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: "canceled",
            subscriptionTier: "FREE",
            trialEndsAt: null,
            stripeSubscriptionId: null,
          },
        });
        break;
      }

      // ─── Billing events ────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const user = await db.user.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
          select: { id: true },
        });
        if (!user) {
          console.error(
            `invoice.payment_failed: no user for customer ${invoice.customer}`,
          );
          break;
        }

        // Don't downgrade yet — Stripe retries for up to 3 weeks and
        // many failures are transient (expired card, temporary hold).
        // Just flag the status so the UI can show a banner.
        await db.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: "past_due" },
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        // Only act on subscription invoices (not one-off)
        const user = await db.user.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
          select: { id: true, subscriptionStatus: true },
        });
        if (!user) break;

        // Clear a prior past_due flag once payment succeeds
        if (user.subscriptionStatus === "past_due") {
          await db.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "active" },
          });
        }
        break;
      }

      default:
        // Log but return 200 — Stripe retries non-2xx responses
        console.log(`Unhandled webhook event: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    // Return 200 to prevent Stripe retry storms on persistent errors.
    // The event is logged above so we can replay manually if needed.
  }

  return NextResponse.json({ received: true });
}