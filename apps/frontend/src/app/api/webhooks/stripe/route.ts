import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const session = event.data.object as any;

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = session.metadata?.userId;
      if (!userId) {
        console.error("No userId in session metadata");
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }

      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const customerId = session.customer as string;

      await db.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          subscriptionTier: "GROWER",
          subscriptionStatus: subscription.status,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
      });

      // Analytics will be added in Phase 7
      break;
    }

    case "customer.subscription.updated": {
      const subscriptionId = session.id;
      const customerId = session.customer;

      const user = await db.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) {
        console.error("User not found for customer:", customerId);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: session.status,
          trialEndsAt: session.trial_end ? new Date(session.trial_end * 1000) : null,
          // If subscription is canceled, update tier
          subscriptionTier: session.status === "active" || session.status === "trialing" ? "GROWER" : "FREE",
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const customerId = session.customer;

      const user = await db.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) {
        console.error("User not found for customer:", customerId);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: "canceled",
          subscriptionTier: "FREE",
          trialEndsAt: null,
        },
      });

      // Analytics will be added in Phase 7
      break;
    }

    case "invoice.payment_succeeded": {
      // Optional: update invoice details or send receipt
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}