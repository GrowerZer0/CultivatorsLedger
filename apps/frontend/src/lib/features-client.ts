// Client-safe version of features – uses API calls instead of direct DB access

export type UserTier = "FREE" | "GROWER";

export type FeatureName =
  | "manual_logging"
  | "environment_tracking"
  | "basic_dashboard"
  | "ai_insights"
  | "photo_upload"
  | "dryback_charts"
  | "plant_weight_trends"
  | "export_csv"
  | "smart_notifications";

export const TIER_FEATURES: Record<UserTier, { maxPlants: number; maxAICallsPerMonth: number; allowedFeatures: FeatureName[] }> =
  {
    FREE: {
      maxPlants: 3,
      maxAICallsPerMonth: 5,
      allowedFeatures: ["manual_logging", "environment_tracking", "basic_dashboard"],
    },
    GROWER: {
      maxPlants: 999,
      maxAICallsPerMonth: -1, // unlimited
      allowedFeatures: [
        "manual_logging",
        "environment_tracking",
        "basic_dashboard",
        "ai_insights",
        "photo_upload",
        "dryback_charts",
        "plant_weight_trends",
        "export_csv",
        "smart_notifications",
      ],
    },
  };

/**
 * Client-side helper: get tier info without DB access
 * Use this in client components. For server-side checks, use features.ts
 */
export function getTierInfo(tier: UserTier) {
  return TIER_FEATURES[tier] || TIER_FEATURES.FREE;
}

/**
 * Client-side helper: check if a tier has a feature
 */
export function tierHasFeature(tier: UserTier, feature: FeatureName): boolean {
  const info = getTierInfo(tier);
  return info.allowedFeatures.includes(feature);
}

/**
 * Client-side helper: get plant limit for a tier
 */
export function getTierPlantLimit(tier: UserTier): number {
  return getTierInfo(tier).maxPlants;
}