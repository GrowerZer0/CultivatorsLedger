"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Scale,
  Droplet,
  FlaskConical,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type DryBackLog = {
  id: string;
  cultivar: string;
  containerGallons: number;
  wetWeight: number;
  dryTarget: number;
  weight: number;
  runoff_ec?: number;
  loggedAt: string;
  source?: string;
  plantId?: string | null;
  watered: boolean;
  fed: boolean;
  trainingEvent?: string | null;
};

type Plant = {
  id: string;
  name: string;
  strain?: string | null;
  currentWeight?: number | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  mirrorPlantId?: string | null;
  thumbnailUrl?: string | null;
  stage?: string | null;
  flipDate?: string | null;
  startDate?: string | null;
};

interface PlantStatusListProps {
  plants: Plant[];
  dryBackLogs: DryBackLog[];
  isLoading?: boolean;
  onRefresh?: () => void;
  lastRefreshTime?: string;
  onLogReading: (plantId: string) => void;
  onNutrientCalc: (plantId: string) => void;
}

const HEADS_UP_THRESHOLD = 15;
const WATER_NOW_THRESHOLD = 20;
const STALE_MINUTES = 60; // bumped from 10 — sensor only polls every ~60s

interface PlantState {
  plant: Plant;
  currentWeight: number | null;
  wetWeight: number | null;
  drybackPercent: number | null;
  minutesSinceReading: number | null;
  isStale: boolean;
  isMirrored: boolean;
  mirroredSourceName?: string | null;
  stageLabel: string;        // "Flower" / "Veg" / "Seedling" / etc.
  weekLabel: string;         // "Flower Week 3" / "Veg Week 1" / "Day 5"
  weightDisplay: string;     // "412.3 g" or "12.45 lbs"
  fcDisplay: string | null;  // "FC 13.10 lbs"
  drybackColor: "green" | "amber" | "red" | "neutral";
  statusIcon: typeof CheckCircle2;
}

function getMinutesSince(isoTimestamp: string): number {
  const then = new Date(isoTimestamp).getTime();
  return Math.floor((Date.now() - then) / 1000 / 60);
}

function formatTimeAgo(minutes: number | null): string {
  if (minutes === null) return "no data";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function computeStageAndWeek(
  plant: Plant,
): { stageLabel: string; weekLabel: string } {
  const stage = (plant.stage || "seedling").toLowerCase();
  const stageLabel =
    stage === "flowering"
      ? "Flower"
      : stage === "vegetative"
      ? "Veg"
      : stage === "seedling"
      ? "Seedling"
      : stage === "dry"
      ? "Dry"
      : stage === "cure"
      ? "Cure"
      : stage.charAt(0).toUpperCase() + stage.slice(1);

  // Week is only meaningful in veg/flower.
  if (stage === "vegetative" && plant.startDate) {
    const days = Math.floor(
      (Date.now() - new Date(plant.startDate).getTime()) / 86_400_000,
    );
    const week = Math.floor(days / 7) + 1;
    return { stageLabel, weekLabel: `Veg Week ${week}` };
  }
  if (stage === "flowering" && plant.flipDate) {
    const days = Math.floor(
      (Date.now() - new Date(plant.flipDate).getTime()) / 86_400_000,
    );
    const week = Math.floor(days / 7) + 1;
    return { stageLabel, weekLabel: `Flower Week ${week}` };
  }
  if (stage === "seedling" && plant.startDate) {
    const days = Math.floor(
      (Date.now() - new Date(plant.startDate).getTime()) / 86_400_000,
    );
    return { stageLabel, weekLabel: `Day ${days}` };
  }
  return { stageLabel, weekLabel: stageLabel };
}

const isSmallScale = (source?: string | null) =>
  !!source?.toLowerCase().includes("small");

export function PlantStatusList({
  plants,
  dryBackLogs,
  isLoading = false,
  onRefresh,
  lastRefreshTime,
  onLogReading,
  onNutrientCalc,
}: PlantStatusListProps) {
  const plantStates = useMemo<PlantState[]>(() => {
    const latestByPlant = new Map<string, DryBackLog>();
    for (const log of dryBackLogs) {
      if (!log.plantId) continue;
      if (log.source !== "esp32" && log.source !== "loadcell") continue;
      const existing = latestByPlant.get(log.plantId);
      if (!existing || new Date(log.loggedAt) > new Date(existing.loggedAt)) {
        latestByPlant.set(log.plantId, log);
      }
    }

    return plants.map((plant) => {
      const latestLog = latestByPlant.get(plant.id) || null;

      let effectiveLog = latestLog;
      let effectiveWet = plant.wetWeight ?? null;
      let isMirrored = false;
      let mirroredSourceName: string | null = null;

      if (!latestLog && plant.mirrorPlantId) {
        const sourcePlant = plants.find((p) => p.id === plant.mirrorPlantId);
        const sourceLog = sourcePlant
          ? latestByPlant.get(sourcePlant.id)
          : null;
        if (sourceLog) {
          effectiveLog = sourceLog;
          effectiveWet = sourcePlant?.wetWeight ?? null;
          isMirrored = true;
          mirroredSourceName = sourcePlant?.name || null;
        }
      }

      const currentWeight = effectiveLog ? effectiveLog.weight : null;
      const wetWeight =
        effectiveWet ?? effectiveLog?.wetWeight ?? null;

      let drybackPercent: number | null = null;
      if (
        currentWeight !== null &&
        wetWeight !== null &&
        Number(wetWeight) > 0
      ) {
        drybackPercent = Math.max(
          0,
          ((Number(wetWeight) - Number(currentWeight)) / Number(wetWeight)) *
            100,
        );
      }

      const minutesSinceReading = effectiveLog
        ? getMinutesSince(effectiveLog.loggedAt)
        : null;
      const isStale =
        minutesSinceReading === null || minutesSinceReading > STALE_MINUTES;

      // Unit logic: seedling OR small load cell → grams
      const useGrams =
        plant.stage === "seedling" ||
        isSmallScale(effectiveLog?.source ?? null);

      const weightDisplay =
        currentWeight === null
          ? "—"
          : useGrams
          ? `${(Number(currentWeight) * 453.592).toFixed(1)} g`
          : `${Number(currentWeight).toFixed(2)} lbs`;

      const fcDisplay =
        wetWeight === null
          ? null
          : useGrams
          ? `FC ${(Number(wetWeight) * 453.592).toFixed(1)} g`
          : `FC ${Number(wetWeight).toFixed(2)} lbs`;

      let drybackColor: PlantState["drybackColor"] = "neutral";
      let statusIcon: typeof CheckCircle2 = AlertTriangle;
      if (drybackPercent !== null) {
        if (drybackPercent >= WATER_NOW_THRESHOLD) {
          drybackColor = "red";
          statusIcon = Droplet;
        } else if (drybackPercent >= HEADS_UP_THRESHOLD) {
          drybackColor = "amber";
          statusIcon = Clock;
        } else {
          drybackColor = "green";
          statusIcon = CheckCircle2;
        }
      }

      const { stageLabel, weekLabel } = computeStageAndWeek(plant);

      return {
        plant,
        currentWeight,
        wetWeight,
        drybackPercent,
        minutesSinceReading,
        isStale,
        isMirrored,
        mirroredSourceName,
        stageLabel,
        weekLabel,
        weightDisplay,
        fcDisplay,
        drybackColor,
        statusIcon,
      };
    });
  }, [plants, dryBackLogs]);

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
        {plantStates.map((state) => (
          <PlantRow
            key={state.plant.id}
            state={state}
            onLogReading={onLogReading}
            onNutrientCalc={onNutrientCalc}
          />
        ))}
      </div>
    </div>
  );
}

function PlantRow({
  state,
  onLogReading,
  onNutrientCalc,
}: {
  state: PlantState;
  onLogReading: (plantId: string) => void;
  onNutrientCalc: (plantId: string) => void;
}) {
  const {
    plant,
    drybackPercent,
    minutesSinceReading,
    isStale,
    isMirrored,
    mirroredSourceName,
    stageLabel,
    weekLabel,
    weightDisplay,
    fcDisplay,
    drybackColor,
    statusIcon: StatusIcon,
  } = state;

  const drybackTextClass =
    drybackColor === "red"
      ? "text-red-500"
      : drybackColor === "amber"
      ? "text-amber-500"
      : drybackColor === "green"
      ? "text-emerald-500"
      : "text-zinc-400";

  return (
    <div className="px-4 sm:px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
      <div className="flex items-center gap-3">
        {/* Thumbnail → plant page */}
        <Link
          href={`/plants/${plant.id}`}
          className="size-11 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 block"
        >
          {plant.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plant.thumbnailUrl}
              alt={plant.name}
              className="size-11 object-cover"
            />
          ) : (
            <div className="size-11 grid place-items-center text-zinc-400 text-xs">
              —
            </div>
          )}
        </Link>

        {/* Name / stage / weight (flex-1, min-w-0 for truncation) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/plants/${plant.id}`}
              className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate hover:underline"
            >
              {plant.name}
            </Link>
            {isMirrored && mirroredSourceName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-medium">
                🔄 {mirroredSourceName}
              </span>
            )}
            {isStale && state.currentWeight !== null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <Clock className="size-2.5" />
                {formatTimeAgo(minutesSinceReading)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {weekLabel}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="font-mono">{weightDisplay}</span>
            {fcDisplay && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                {fcDisplay}
              </span>
            )}
          </div>
        </div>

        {/* Dryback */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {drybackPercent !== null ? (
            <>
              <StatusIcon className={`size-4 ${drybackTextClass}`} />
              <div className="text-right">
                <div className={`text-lg font-bold leading-none ${drybackTextClass}`}>
                  {Number(drybackPercent).toFixed(1)}%
                </div>
                <div className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-0.5">
                  dryback
                </div>
              </div>
            </>
          ) : (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              no data
            </span>
          )}
        </div>

        {/* Quick actions per row */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onLogReading(plant.id)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
            title={`Log reading for ${plant.name}`}
          >
            <Scale className="size-3.5" />
            <span className="hidden md:inline">Log</span>
          </button>
          <button
            onClick={() => onNutrientCalc(plant.id)}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-bold transition-colors flex items-center gap-1"
            title={`Nutrient calculator for ${plant.name}`}
          >
            <FlaskConical className="size-3.5" />
            <span className="hidden md:inline">Feed</span>
          </button>
        </div>
      </div>

      {/* Mobile-only dryback line so it's still visible on phones */}
      <div className="sm:hidden mt-2 ml-14 flex items-center gap-1.5">
        {drybackPercent !== null ? (
          <>
            <StatusIcon className={`size-3.5 ${drybackTextClass}`} />
            <span className={`text-sm font-bold ${drybackTextClass}`}>
              {Number(drybackPercent).toFixed(1)}% dryback
            </span>
          </>
        ) : (
          <span className="text-[10px] text-zinc-400">no dryback data</span>
        )}
      </div>
    </div>
  );
}