// src/app/actions/profile.ts
"use server";

import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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
 * Returns null if not authenticated.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
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
    // Create default profile if none exists
    const newProfile = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email!,
        displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        timezone: "UTC",
        language: "en",
        preferredTempUnit: "C",
        activeFeedLine: null,
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

    // Cast the preferredTempUnit to union type
    return {
      ...newProfile,
      preferredTempUnit: newProfile.preferredTempUnit as "C" | "F",
    };
  }

  // Cast for existing profile
  return {
    ...profile,
    preferredTempUnit: profile.preferredTempUnit as "C" | "F",
  };
}

/**
 * Update the current user's profile.
 * Returns the updated profile.
 */
export async function updateUserProfile(
  data: Partial<Omit<UserProfile, "id" | "email">>
): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { displayName, timezone, language, preferredTempUnit, activeFeedLine } = data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      timezone,
      language,
      preferredTempUnit,
      activeFeedLine,
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

  // Cast before returning
  return {
    ...updated,
    preferredTempUnit: updated.preferredTempUnit as "C" | "F",
  };
}