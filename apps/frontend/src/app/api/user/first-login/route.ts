import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Get the user's current first_login_at value
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstLoginAt: true, onboardingStep: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isFirstLogin = user.firstLoginAt === null;

    // If this is the first login, update the user record
    if (isFirstLogin) {
      await db.user.update({
        where: { id: userId },
        data: {
          firstLoginAt: new Date(),
          onboardingStep: 1, // Start onboarding at step 1
        },
      });
    }

    return NextResponse.json({
      isFirstLogin,
      onboardingStep: user.onboardingStep || 0,
    });
  } catch (error) {
    console.error("Error checking first login:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}