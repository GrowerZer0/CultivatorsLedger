"use client";

import Link from "next/link";
import { WeightInput } from "@/components/dashboard/WeightInput";
import type { Plant } from "@/types/plant";
import { DryCureTracker } from "@/components/facility/DryCureTracker";

type Variant = "row" | "card" | "header";

interface PlantSummaryProps {
  plant: Plant;
  latestWeight: number | null;
  latestReadingMinutesAgo: number | null;
  drybackPercent: number | null;
  stageLabel: string;
  weekLabel: string;
  weightDisplay: string;
  fcDisplay: string | null;
  useGrams: boolean;
  thumbnailUrl?: string | null;
  variant?: Variant;
  href?: string;
}

export function PlantSummary({
  plant,
  latestWeight,
  latestReadingMinutesAgo,
  drybackPercent,
  stageLabel,
  weekLabel,
  weightDisplay,
  fcDisplay,
  useGrams,
  thumbnailUrl,
  variant = "row",
  href = `/plants/${plant.id}`,
}: PlantSummaryProps) {
  const isCard = variant === "card";
  const isHeader = variant === "header";
  const isCure = plant.stage === "cure";
  const isDry = plant.stage === "dry";

  const weightBlock = (
    <div className="flex flex-col">
      <WeightInput
        plantId={plant.id}
        currentWeightLbs={latestWeight}
        unitLabel={useGrams ? "g" : "lbs"}
        displayValue={weightDisplay}
        isSmallScale={useGrams}
        hasAssignedScale={(plant.sensorConfigs ?? []).length > 0}
        minutesSinceReading={latestReadingMinutesAgo}
      />
      {plant.sensorConfigs && plant.sensorConfigs.length > 0 && (
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono pl-1 mt-0.5">
          {plant.sensorConfigs[0].name}
        </span>
      )}
    </div>
  );

  const badge = (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border border-zinc-200 dark:border-zinc-700">
      {stageLabel}
    </span>
  );

  const metaLine = (
    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
        {weekLabel}
      </span>
      <span className="text-zinc-300 dark:text-zinc-700">·</span>
      {weightBlock}
      {fcDisplay && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
          {fcDisplay}
        </span>
      )}
    </div>
  );

  // ==========================================================
  // DRY / CURE — custom tracker layout, not a link
  // ==========================================================
  if (isCure || isDry) {
    const stageStarted = plant.currentStageStartedAt || plant.updatedAt;
    const dayCount = stageStarted
      ? Math.floor((Date.now() - new Date(stageStarted).getTime()) / 86400000) + 1
      : 1;

    return (
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {plant.name}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                isCure
                  ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50"
                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
              }`}
            >
              {isCure ? "Curing" : "Drying"}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              Day {dayCount}
            </span>
          </div>
          <Link href={href} className="text-xs text-emerald-500 hover:underline">
            View Details →
          </Link>
        </div>
        <DryCureTracker
          plantId={plant.id}
          stage={plant.stage as "dry" | "cure"}
          lastWeight={latestWeight}
        />
      </div>
    );
  }

  // ==========================================================
  // HEADER (plant detail page)
  // ==========================================================
  if (isHeader) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">
            {plant.name}
          </h1>
          {badge}
        </div>
        {plant.strain && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            {plant.strain}
          </p>
        )}
        {metaLine}
      </div>
    );
  }

  // ==========================================================
  // ROW (dashboard / plants list / picker)
  // ==========================================================
  if (isCard) {
    return (
      <Link
        href={href}
        className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 hover:border-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex flex-col gap-3">
          <div className="aspect-square w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt={plant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-zinc-400 text-xs">
                No photo
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-zinc-900 dark:text-white truncate">
              {plant.name}
            </span>
            {badge}
          </div>
          {metaLine}
        </div>
      </Link>
    );
  }

  // default: row
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
    >
      <div className="size-11 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={plant.name} className="size-11 object-cover" />
        ) : (
          <div className="size-11 grid place-items-center text-zinc-400 text-xs">—</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {plant.name}
          </span>
          {badge}
        </div>
        {metaLine}
      </div>
      {drybackPercent !== null && (
        <div className="shrink-0 text-right">
          <div
            className={`text-lg font-bold ${
              drybackPercent >= 20
                ? "text-red-500"
                : drybackPercent >= 15
                  ? "text-amber-500"
                  : "text-emerald-500"
            }`}
          >
            {drybackPercent.toFixed(1)}%
          </div>
          <div className="text-[9px] text-zinc-400 uppercase tracking-wider">
            dryback
          </div>
        </div>
      )}
    </Link>
  );
}