"use client";

import { Scale, RefreshCw } from "lucide-react";
import { PlantSummary } from "@/components/plants/PlantSummary";
import { stageLabel as getStageLabel, weekLabel as getWeekLabel } from "@/lib/stage-label";
import type { Plant } from "@/types/plant";

interface PlantStatusListProps {
  plants: Plant[];
  isLoading?: boolean;
  onRefresh?: () => void;
  lastRefreshTime?: string;
  onWater: (plantId: string) => void;
}

export function PlantStatusList({
  plants,
  isLoading = false,
  onRefresh,
  lastRefreshTime,
  onWater
}: PlantStatusListProps) {
  if (plants.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
        <Scale className="size-6 text-zinc-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          No plants yet
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Start a grow to see plant status here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Plant Status
          </h2>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {plants.length} {plants.length === 1 ? "plant" : "plants"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshTime && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {lastRefreshTime}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {plants.map((plant) => {
          const stageLabel = getStageLabel(plant.stage);
          const weekLabel = getWeekLabel(plant.stage, plant.currentStageStartedAt);
          const currentWeight = plant.currentWeight ?? null;
          const wetWeight = plant.wetWeight ?? null;
          const useGrams = plant.stage === "seedling";
          
          const weightDisplay = currentWeight === null ? "—"
            : useGrams ? `${(Number(currentWeight) * 453.592).toFixed(1)} g`
            : `${Number(currentWeight).toFixed(2)} lbs`;
            
          const fcDisplay = wetWeight === null ? null
            : useGrams ? `FC ${(Number(wetWeight) * 453.592).toFixed(1)} g`
            : `FC ${Number(wetWeight).toFixed(2)} lbs`;

          let drybackPercent = null;
          if (currentWeight !== null && wetWeight !== null && Number(wetWeight) > 0) {
            drybackPercent = Math.max(0, ((Number(wetWeight) - Number(currentWeight)) / Number(wetWeight)) * 100);
          }

          let minutesSinceReading = null;
          if (plant.currentWeightTimestamp) {
            minutesSinceReading = Math.floor((Date.now() - new Date(plant.currentWeightTimestamp).getTime()) / 60000);
          }

          return (
            <PlantSummary
              key={plant.id}
              plant={plant}
              latestWeight={currentWeight}
              latestReadingMinutesAgo={minutesSinceReading}
              drybackPercent={drybackPercent}
              stageLabel={stageLabel}
              weekLabel={weekLabel}
              weightDisplay={weightDisplay}
              fcDisplay={fcDisplay}
              useGrams={useGrams}
              thumbnailUrl={plant.thumbnailUrl}
              variant="row"
              onWater={onWater}
            />
          );
        })}
      </div>
    </div>
  );
}