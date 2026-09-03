"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;

export async function getOnboardingStep(userId?: string): Promise<{ step: OnboardingStep; completed: boolean }> {
  const id = userId || (await getUserId());
  if (!id) return { step: 0, completed: false };

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { 
        onboardingStep: true, 
        onboardingCompleted: true,
      },
    });

    return {
      step: (user?.onboardingStep as OnboardingStep) || 0,
      completed: user?.onboardingCompleted || false,
    };
  } catch (error) {
    console.error("Error getting onboarding step:", error);
    return { step: 0, completed: false };
  }
}

export async function advanceOnboardingStep(userId?: string): Promise<{ success: boolean; step: OnboardingStep; completed: boolean }> {
  const id = userId || (await getUserId());
  if (!id) return { success: false, step: 0, completed: false };

  try {
    const current = await getOnboardingStep(id);
    
    if (current.completed) {
      return { success: true, step: 5, completed: true };
    }

    const nextStep = Math.min(current.step + 1, 5) as OnboardingStep;
    const isCompleted = nextStep === 5;

    await db.user.update({
      where: { id },
      data: {
        onboardingStep: nextStep,
        onboardingCompleted: isCompleted,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/plants");
    revalidatePath("/check-in");
    revalidatePath("/");
    
    return { success: true, step: nextStep, completed: isCompleted };
  } catch (error) {
    console.error("Error advancing onboarding step:", error);
    return { success: false, step: 0, completed: false };
  }
}

export async function setOnboardingStep(step: OnboardingStep, userId?: string): Promise<{ success: boolean }> {
  const id = userId || (await getUserId());
  if (!id) return { success: false };

  try {
    await db.user.update({
      where: { id },
      data: {
        onboardingStep: step,
        onboardingCompleted: step === 5,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/plants");
    revalidatePath("/check-in");
    revalidatePath("/");
    
    return { success: true };
  } catch (error) {
    console.error("Error setting onboarding step:", error);
    return { success: false };
  }
}

export async function getOnboardingState(userId?: string) {
  const id = userId || (await getUserId());
  if (!id) {
    return {
      step: 0 as OnboardingStep,
      completed: false,
      dismissed: false,
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        onboardingStep: true,
        onboardingCompleted: true,
        onboardingDismissed: true,
      },
    });

    return {
      step: (user?.onboardingStep as OnboardingStep) || 0,
      completed: user?.onboardingCompleted || false,
      dismissed: user?.onboardingDismissed || false,
    };
  } catch (error) {
    console.error("Error getting onboarding state:", error);
    return {
      step: 0 as OnboardingStep,
      completed: false,
      dismissed: false,
    };
  }
}

export async function setOnboardingDismissed(
  dismissed: boolean,
  userId?: string
) {
  const id = userId || (await getUserId());
  if (!id) return { success: false };

  try {
    await db.user.update({
      where: { id },
      data: { onboardingDismissed: dismissed },
    });

    revalidatePath("/dashboard");
    revalidatePath("/settings/profile");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("Error setting onboarding dismissed:", error);
    return { success: false };
  }
}
