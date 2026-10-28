export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'harvest' | 'dry' | 'cure';

export interface GrowthStageConfig {
  id: GrowthStage;
  label: string;
  description: string;
  icon: string;
  color: string;
  daysFromStart: number; // approximate days after start date
  targetDurationDays?: number; // optional, for stages like dry and cure
  vpdTarget: { min: number; max: number };
  lightSchedule?: { on: number; off: number }; // hours
  ecRange?: { min: number; max: number };
  phRange?: { min: number; max: number };
}

export const GROWTH_STAGES: Record<GrowthStage, GrowthStageConfig> = {
  seedling: {
    id: 'seedling',
    label: 'Seedling',
    description: 'Early growth phase, delicate root system',
    icon: '🌱',
    color: 'text-green-400',
    daysFromStart: 0,
    vpdTarget: { min: 0.8, max: 1.2 },
    lightSchedule: { on: 18, off: 6 },
    ecRange: { min: 0.5, max: 1.2 },
    phRange: { min: 5.8, max: 6.3 },
  },
  vegetative: {
    id: 'vegetative',
    label: 'Vegetative',
    description: 'Rapid growth, building structure',
    icon: '🌿',
    color: 'text-emerald-400',
    daysFromStart: 14,
    vpdTarget: { min: 0.8, max: 1.2 },
    lightSchedule: { on: 18, off: 6 },
    ecRange: { min: 1.2, max: 2.0 },
    phRange: { min: 5.8, max: 6.5 },
  },
  flowering: {
    id: 'flowering',
    label: 'Flowering',
    description: 'Bud development and ripening',
    icon: '🌸',
    color: 'text-purple-400',
    daysFromStart: 45,
    vpdTarget: { min: 1.0, max: 1.5 },
    lightSchedule: { on: 12, off: 12 },
    ecRange: { min: 1.5, max: 2.5 },
    phRange: { min: 6.0, max: 6.8 },
  },
  harvest: {
    id: 'harvest',
    label: 'Harvest',
    description: 'Plants are ready for harvest',
    icon: '✂️',
    color: 'text-amber-400',
    daysFromStart: 1, // Harvest is not a growth stage, so daysFromStart is not relevant
    targetDurationDays: 1,
    vpdTarget: { min: 1.2, max: 1.8 },
    lightSchedule: { on: 0, off: 24 },
    ecRange: { min: 0, max: 0.5 },
    phRange: { min: 6.0, max: 6.5 },
  },
  dry: {
    id: "dry",
    label: "Drying",
    icon: "🍂",
    description: "Drying at 60°F / 60% RH. Target: 7-14 days.",
    daysFromStart: 1,
    targetDurationDays: 10,
    color: "text-amber-600",
    vpdTarget: { min: 0.8, max: 1.2 },
  },
  cure: {
    id: "cure",
    label: "Curing",
    icon: "🫙",
    description: "Curing in jars. Burp regularly until RH stabilizes at 62%.",
    daysFromStart: 1,
    targetDurationDays: 30,
    color: "text-emerald-500",
    vpdTarget: { min: 0.8, max: 1.2 },
  },
};

export function getStageFromDays(daysSinceStart: number): GrowthStage {
  if (daysSinceStart < 14) return 'seedling';
  if (daysSinceStart < 45) return 'vegetative';
  if (daysSinceStart < 65) return 'flowering';
  return 'harvest';
}

export function getNextStage(currentStage: GrowthStage): GrowthStage | null {
  const stages: GrowthStage[] = ['seedling', 'vegetative', 'flowering', 'harvest'];
  const currentIndex = stages.indexOf(currentStage);
  if (currentIndex === stages.length - 1) return null;
  return stages[currentIndex + 1];
}

export function getStageProgress(daysSinceStart: number, stage: GrowthStage, daysInStage?: number): number {
  const config = GROWTH_STAGES[stage];
  if (!config) return 0;

  // 1. Handle Lifecycle Stages (Harvest, Dry, Cure)
  // These have a fixed target duration instead of a "next stage" date.
  if (config.targetDurationDays && daysInStage !== undefined) {
    const progress = (daysInStage / config.targetDurationDays) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  // 2. Handle Standard Growth Stages (Seedling, Veg, Flower)
  const nextStage = getNextStage(stage);
  if (!nextStage) return 100; // If it's the last stage and has no target duration, it's 100%
  
  const currentStart = config.daysFromStart;
  const nextStart = GROWTH_STAGES[nextStage].daysFromStart;
  const duration = nextStart - currentStart;
  
  if (duration <= 0) return 0; // Prevent division by zero

  const progress = ((daysSinceStart - currentStart) / duration) * 100;
  
  return Math.min(Math.max(progress, 0), 100);
}
