export interface StageAdvanceHint {
  days: number;
  progress: number; // 0–100
  shouldSuggestAdvance: boolean;
  advanceLabel: string | null;
  hint: string | null;
}

export function getStageHint(plant: {
  stage: string | null;
  currentStageStartedAt: string | null;
  startDate: string | null;
  flipDate: string | null;
}): StageAdvanceHint {
  const stage = (plant.stage || "seedling").toLowerCase();

  // Determine when the current stage started
  const startedAt =
    plant.currentStageStartedAt ||
    (stage === "flowering" ? plant.flipDate : null) ||
    plant.startDate;

  if (!startedAt) {
    return {
      days: 0,
      progress: 0,
      shouldSuggestAdvance: false,
      advanceLabel: null,
      hint: null,
    };
  }

  const days = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 86_400_000,
  );

  // Per-stage threshold logic
  switch (stage) {
    case "seedling": {
      const threshold = 14;
      return {
        days,
        progress: Math.min(100, (days / threshold) * 100),
        shouldSuggestAdvance: days >= threshold,
        advanceLabel: days >= threshold ? "Advance to Veg" : null,
        hint:
          days >= threshold
            ? "Seedling stage typically ends around day 14. Ready to move to veg?"
            : null,
      };
    }

    case "vegetative": {
      const threshold = 28; // 4 weeks
      return {
        days,
        progress: Math.min(100, (days / threshold) * 100),
        shouldSuggestAdvance: false,
        advanceLabel: null,
        hint:
          days >= threshold
            ? "Consider flipping to flower. Check your space and plant size."
            : null,
      };
    }

    case "flowering": {
      const threshold = 56; // 8 weeks
      return {
        days,
        progress: Math.min(100, (days / threshold) * 100),
        shouldSuggestAdvance: false,
        advanceLabel: null,
        hint:
          days >= threshold
            ? "Harvest window opening. Check trichomes — cloudy with some amber is peak."
            : null,
      };
    }

    case "dry": {
      const threshold = 10; // 10 days typical dry
      return {
        days,
        progress: Math.min(100, (days / threshold) * 100),
        shouldSuggestAdvance: false,
        advanceLabel: null,
        hint:
          days >= 7
            ? "Stems should start snapping. Ready to begin curing?"
            : null,
      };
    }

    case "cure": {
      const threshold = 14; // 2 weeks minimum
      return {
        days,
        progress: Math.min(100, (days / threshold) * 100),
        shouldSuggestAdvance: false,
        advanceLabel: null,
        hint:
          days >= 14
            ? "Cure is complete. Ready to archive this grow?"
            : null,
      };
    }

    default:
      return {
        days,
        progress: 0,
        shouldSuggestAdvance: false,
        advanceLabel: null,
        hint: null,
      };
  }
}