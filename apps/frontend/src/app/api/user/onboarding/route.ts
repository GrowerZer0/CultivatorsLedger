import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        onboardingStep: true,
        onboardingCompleted: true,
        onboardingDismissed: true,
      },
    });

    return NextResponse.json({
      onboardingStep: user?.onboardingStep || 0,
      onboardingCompleted: user?.onboardingCompleted || false,
      onboardingDismissed: user?.onboardingDismissed || false,
      dashboardVisited: true, // We can track this separately
    });
  } catch (error) {
    console.error("Error fetching onboarding state:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding state" },
      { status: 500 }
    );
  }
}
