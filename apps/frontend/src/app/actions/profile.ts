"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { serializePrisma } from "@/lib/serializePrisma";

export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  language: string;
  preferredTempUnit: "C" | "F";
  activeFeedLine: string | null;
};

/**
 * Get the current user's profile.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const userId = await getUserId();

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      timezone: true,
      language: true,
      preferredTempUnit: true,
      activeFeedLine: true,
    },
  });

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    preferredTempUnit: profile.preferredTempUnit as "C" | "F",
  };
}


/**
 * Update the current user's profile.
 */
export async function updateUserProfile(
  data: Partial<Omit<UserProfile, "id" | "email">>
) {
  const userId = await getUserId();

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: data.displayName,
      timezone: data.timezone,
      language: data.language,
      preferredTempUnit: data.preferredTempUnit,
      activeFeedLine: data.activeFeedLine,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      timezone: true,
      language: true,
      preferredTempUnit: true,
      activeFeedLine: true,
    },
  });

  revalidatePath("/settings/profile");
  revalidatePath("/settings/system");

  return {
    ...updated,
    preferredTempUnit: updated.preferredTempUnit as "C" | "F",
  };
}