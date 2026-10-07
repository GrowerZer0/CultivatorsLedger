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
  harvest: 25.0,
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
        userSetting = user.drybackStageHarvest !== null ? Number(user.drybackStageHarvest) : null;
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