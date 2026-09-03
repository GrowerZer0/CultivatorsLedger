export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'harvest';

export interface GrowthStageConfig {
  id: GrowthStage;
  label: string;
  description: string;
  icon: string;
  color: string;
  daysFromStart: number; // approximate days after start date
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
    label: 'Harvest Ready',
    description: 'Plants are ready for harvest',
    icon: '✂️',
    color: 'text-amber-400',
    daysFromStart: 65,
    vpdTarget: { min: 1.2, max: 1.8 },
    lightSchedule: { on: 0, off: 24 },
    ecRange: { min: 0, max: 0.5 },
    phRange: { min: 6.0, max: 6.5 },
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

export function getStageProgress(daysSinceStart: number, stage: GrowthStage): number {
  const config = GROWTH_STAGES[stage];
  const nextStage = getNextStage(stage);
  if (!nextStage) return 100;
  
  const currentStart = config.daysFromStart;
  const nextStart = GROWTH_STAGES[nextStage].daysFromStart;
  const duration = nextStart - currentStart;
  const progress = ((daysSinceStart - currentStart) / duration) * 100;
  
  return Math.min(Math.max(progress, 0), 100);
}
