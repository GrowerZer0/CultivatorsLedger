"use server";

import { stripe, STRIPE_PRICE_GROWER_MONTHLY, STRIPE_PORTAL_CONFIG } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(priceId?: string, successUrl?: string, cancelUrl?: string) {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user) throw new Error("User not found");

    const price = priceId || STRIPE_PRICE_GROWER_MONTHLY;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      line_items: [{ price, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14, // 14-day free trial
      },
      success_url: successUrl || `${baseUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/pricing?canceled=true`,
      metadata: { userId },
      allow_promotion_codes: true,
    });

    return { success: true, sessionId: session.id, url: session.url };
  } catch (error) {
    console.error("createCheckoutSession error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create checkout session" };
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createPortalSession(returnUrl?: string) {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user || !user.stripeCustomerId) {
      throw new Error("No active subscription found");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || `${baseUrl}/settings/billing`,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error("createPortalSession error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create portal session" };
  }
}

/**
 * Cancel a subscription (immediate or at period end)
 */
export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true) {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    return { success: true };
  } catch (error) {
    console.error("cancelSubscription error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to cancel subscription" };
  }
}