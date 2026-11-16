export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'harvest';

export interface DrybackUserSettings {
  drybackStageSeedling: any;
  drybackStageVeg: any;
  drybackStageFlowering: any;
  drybackStageHarvest: any;
}

export interface DrybackPlantSettings {
  stage: any;
  drybackOverride: any;
}

export interface DrybackTarget {
  targetPercent: number;
  source: 'override' | 'stage' | 'default';
  stage: string | null;
}

const DEFAULT_TARGETS: Record<string, number> = {
  seedling: 5.0,
  vegetative: 6.0,
  flowering: 20.0,
  harvest: 20.0,  // same as flowering
  };

export function getDrybackTargetForPlant(
  plant: DrybackPlantSettings,
  user: DrybackUserSettings | null
): DrybackTarget {
  // 1. Per-plant override takes priority
  if (plant.drybackOverride !== null && plant.drybackOverride !== undefined) {
    const override = Number(plant.drybackOverride);
    if (!isNaN(override) && override > 0 && override <= 100) {
      return { targetPercent: override, source: 'override', stage: plant.stage };
    }
  }

  // 2. Stage-based setting from user
  if (user) {
    const stageKey = plant.stage?.toLowerCase() || '';
    let userSetting: number | null = null;
    switch (stageKey) {
      case 'seedling':
        userSetting = user.drybackStageSeedling !== null ? Number(user.drybackStageSeedling) : null;
        break;
      case 'vegetative':
        userSetting = user.drybackStageVeg !== null ? Number(user.drybackStageVeg) : null;
        break;
      case 'flowering':
        userSetting = user.drybackStageFlowering !== null ? Number(user.drybackStageFlowering) : null;
        break;
      case 'harvest':
        // Harvest stage uses the flowering target — we're still watering until chop
        userSetting = user.drybackStageFlowering !== null ? Number(user.drybackStageFlowering) : null;
        break;
    }
    if (userSetting !== null && !isNaN(userSetting) && userSetting > 0) {
      return { targetPercent: userSetting, source: 'stage', stage: plant.stage };
    }
  }

  // 3. Fallback to hardcoded default based on stage
  const fallback = DEFAULT_TARGETS[plant.stage?.toLowerCase() || ''] ?? 20.0;
  return { targetPercent: fallback, source: 'default', stage: plant.stage };
}

export function computeDryTarget(wetWeight: number, drybackPercent: number): number {
  return Math.round(wetWeight * (1 - drybackPercent / 100) * 100) / 100;
}

/**
 * Canonical dryback: how far the pot has moved through its usable water
 * range, from field capacity (0%) to dry target (100%).
 *
 *   dryback% = (wet - current) / (wet - dryTarget) * 100
 *
 * This is the ONLY dryback formula in the app. Do not inline a variant
 * elsewhere; if a call site needs different behavior, change this function.
 *
 * Returns null when a meaningful percentage cannot be computed:
 *   - no/invalid wet weight (FC not set)
 *   - no/invalid current weight
 *   - no/invalid dry target, or dryTarget >= wet (no usable range)
 *
 * Result is clamped to 0–100. 100% means "at dry target" (water now).
 */
export function computeDryback(
  wetWeightLbs: number | null | undefined,
  currentWeightLbs: number | null | undefined,
  dryTargetLbs: number | null | undefined,
): number | null {
  const wet = Number(wetWeightLbs);
  const cur = Number(currentWeightLbs);
  const dry = Number(dryTargetLbs);
  if (!Number.isFinite(wet) || wet <= 0) return null;
  if (!Number.isFinite(cur)) return null;
  if (!Number.isFinite(dry) || dry < 0 || dry >= wet) return null;
  const range = wet - dry;
  if (range <= 0) return null;
  const pct = ((wet - cur) / range) * 100;
  return Math.max(0, Math.min(100, pct));
}