import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.user.update({
      where: { id: userId },
      data: {
        onboardingStep: 1,
        onboardingCompleted: false,
        onboardingDismissed: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restarting onboarding:", error);
    return NextResponse.json({ error: "Failed to restart onboarding" }, { status: 500 });
  }
}
