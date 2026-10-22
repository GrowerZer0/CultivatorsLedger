export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'harvest';

interface StageInput {
  startDate: Date;
  flipDate: Date | null;
  manualStage: string | null;
}

interface StageResult {
  stage: GrowthStage;
  source: 'manual' | 'derived';
  daysSinceStart: number;
  daysSinceFlip: number | null;
}

export function derivePlantStage(input: StageInput): StageResult {
  const now = Date.now();
  const startDate = new Date(input.startDate);
  const daysSinceStart = Math.floor((now - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Manual override wins
  if (input.manualStage && ['seedling', 'vegetative', 'flowering', 'harvest'].includes(input.manualStage)) {
    return {
      stage: input.manualStage as GrowthStage,
      source: 'manual',
      daysSinceStart,
      daysSinceFlip: input.flipDate
        ? Math.floor((now - new Date(input.flipDate).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }

  // Derive from dates
  if (!input.flipDate) {
    // No flip yet
    if (daysSinceStart < 14) {
      return { stage: 'seedling', source: 'derived', daysSinceStart, daysSinceFlip: null };
    }
    return { stage: 'vegetative', source: 'derived', daysSinceStart, daysSinceFlip: null };
  }

  const flipDate = new Date(input.flipDate);
  const daysSinceFlip = Math.floor((now - flipDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceFlip < 0) {
    // Flip date is in the future — probably an error, treat as vegetative
    return { stage: 'vegetative', source: 'derived', daysSinceStart, daysSinceFlip: null };
  }
  if (daysSinceFlip < 56) {
    return { stage: 'flowering', source: 'derived', daysSinceStart, daysSinceFlip };
  }
  return { stage: 'harvest', source: 'derived', daysSinceStart, daysSinceFlip };
}