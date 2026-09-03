import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { dismissed } = body;

    await db.user.update({
      where: { id: userId },
      data: { onboardingDismissed: dismissed },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing onboarding:", error);
    return NextResponse.json({ error: "Failed to dismiss onboarding" }, { status: 500 });
  }
}
