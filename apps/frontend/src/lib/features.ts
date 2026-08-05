"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { type UserTier, type FeatureName } from "./features-client";

// Re‑export types (types are fine, they get stripped)
export type { UserTier, FeatureName };

/**
 * Get the user's current tier (server-side only)
 */
export async function getUserTier(userId?: string): Promise<UserTier> {
  const id = userId || (await getUserId());
  if (!id) return "FREE";

  const user = await db.user.findUnique({
    where: { id },
    select: { subscriptionTier: true },
  });

  return (user?.subscriptionTier as UserTier) || "FREE";
}

/**
 * Check if a user has access to a specific feature (server-side only)
 */
export async function canAccessFeature(
  feature: FeatureName,
  userId?: string
): Promise<boolean> {
  const tier = await getUserTier(userId);
  // Import TIER_FEATURES from the client-safe file
  const { TIER_FEATURES } = await import("./features-client");
  const tierConfig = TIER_FEATURES[tier];
  return tierConfig.allowedFeatures.includes(feature);
}

/**
 * Get the plant limit for a user (server-side only)
 */
export async function getPlantLimit(userId?: string): Promise<number> {
  const tier = await getUserTier(userId);
  const { TIER_FEATURES } = await import("./features-client");
  return TIER_FEATURES[tier].maxPlants;
}

/**
 * Get the AI call limit for a user (server-side only)
 */
export async function getAILimit(userId?: string): Promise<number> {
  const tier = await getUserTier(userId);
  const { TIER_FEATURES } = await import("./features-client");
  return TIER_FEATURES[tier].maxAICallsPerMonth;
}

/**
 * Get the current plant count for a user (server-side only)
 */
export async function getPlantCount(userId?: string): Promise<number> {
  const id = userId || (await getUserId());
  if (!id) return 0;

  const count = await db.plant.count({
    where: { userId: id },
  });
  return count;
}

/**
 * Check if a user can add a new plant (server-side only)
 */
export async function canAddPlant(userId?: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const id = userId || (await getUserId());
  if (!id) return { allowed: false, current: 0, limit: 0 };

  const [limit, current] = await Promise.all([getPlantLimit(id), getPlantCount(id)]);

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

/**
 * Check if a user can make an AI call (server-side only)
 */
export async function canMakeAICall(userId?: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const id = userId || (await getUserId());
  if (!id) return { allowed: false, remaining: 0, limit: 0 };

  const limit = await getAILimit(id);
  if (limit === -1) return { allowed: true, remaining: -1, limit: -1 };

  // TODO: Track monthly AI usage
  return { allowed: true, remaining: limit, limit };
}