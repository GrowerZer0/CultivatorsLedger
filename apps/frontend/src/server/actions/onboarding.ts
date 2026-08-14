"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { type OnboardingStep } from "@/lib/onboarding-constants";

export type { OnboardingStep };

/**
 * Get the user's current onboarding step
 */
export async function getOnboardingStep(userId?: string): Promise<{ step: OnboardingStep; completed: boolean }> {
  const id = userId || (await getUserId());
  if (!id) return { step: 0, completed: false };

  const user = await db.user.findUnique({
    where: { id },
    select: { onboardingStep: true, onboardingCompleted: true },
  });

  return {
    step: (user?.onboardingStep as OnboardingStep) || 0,
    completed: user?.onboardingCompleted || false,
  };
}

/**
 * Check if a user has completed onboarding
 */
export async function isOnboardingComplete(userId?: string): Promise<boolean> {
  const { completed } = await getOnboardingStep(userId);
  return completed;
}

/**
 * Advance to the next onboarding step
 */
export async function advanceOnboardingStep(userId?: string): Promise<{ success: boolean; step: OnboardingStep; completed: boolean }> {
  const id = userId || (await getUserId());
  if (!id) return { success: false, step: 0, completed: false };

  const current = await getOnboardingStep(id);
  
  // If already completed, return
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
      firstLoginAt: current.step === 0 ? new Date() : undefined,
    },
  });

  revalidatePath("/dashboard");
  return { success: true, step: nextStep, completed: isCompleted };
}

/**
 * Set a specific onboarding step (for admin or debugging)
 */
export async function setOnboardingStep(step: OnboardingStep, userId?: string): Promise<{ success: boolean }> {
  const id = userId || (await getUserId());
  if (!id) return { success: false };

  await db.user.update({
    where: { id },
    data: {
      onboardingStep: step,
      onboardingCompleted: step === 5,
    },
  });

  revalidatePath("/dashboard");
  return { success: true };
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
}

export async function setOnboardingDismissed(
  dismissed: boolean,
  userId?: string
) {
  const id = userId || (await getUserId());
  if (!id) return { success: false };

  await db.user.update({
    where: { id },
    data: { onboardingDismissed: dismissed },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings/profile");

  return { success: true };
}