"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import { getStageHint } from "@/lib/lifecycle";

interface StageTrackerProps {
  plant: {
    id: string;
    stage: string | null;
    currentStageStartedAt: string | null;
    startDate: string | null;
    flipDate: string | null;
  };
  onAdvance: () => void;
}

export function StageTracker({ plant, onAdvance }: StageTrackerProps) {
  const { days, progress, shouldSuggestAdvance, advanceLabel, hint } =
    getStageHint(plant);

  const stage = (plant.stage || "seedling").toLowerCase();
  const stageDisplay =
    stage === "flowering"
      ? "Flower"
      : stage === "vegetative"
        ? "Veg"
        : stage.charAt(0).toUpperCase() + stage.slice(1);

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {stageDisplay}
          </span>
          <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
            Day {days + 1}
          </span>
        </div>
        {shouldSuggestAdvance && advanceLabel && (
          <button
            onClick={onAdvance}
            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            {advanceLabel}
            <ArrowRight className="size-3" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            shouldSuggestAdvance ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      {/* Hint */}
      {hint && (
        <div className="flex items-start gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 italic">
          <Lightbulb className="size-3 shrink-0 mt-0.5 text-amber-500" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}