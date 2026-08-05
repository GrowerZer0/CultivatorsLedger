import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getPlantCount, getPlantLimit } from "@/lib/features";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [user, plantCount, plantLimit] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
      }),
      getPlantCount(userId),
      getPlantLimit(userId),
    ]);

    return NextResponse.json({
      tier: user?.subscriptionTier || "FREE",
      plantCount,
      plantLimit,
      subscriptionStatus: user?.subscriptionStatus || null,
      trialEndsAt: user?.trialEndsAt?.toISOString() || null,
      hasStripeCustomer: !!user?.stripeCustomerId,
      hasSubscription: !!user?.stripeSubscriptionId,
    });
  } catch (error) {
    console.error("Error fetching billing data:", error);
    return NextResponse.json({ error: "Failed to fetch billing data" }, { status: 500 });
  }
}