"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Scale, Droplet, Clock, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

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
};

interface WeightDrybackCardProps {
  plants: Plant[];
  dryBackLogs: DryBackLog[];
  isLoading?: boolean;
  onRefresh?: () => void;
  lastRefreshTime?: string;
}

// Head's up / Water now thresholds
const HEADS_UP_THRESHOLD = 15;
const WATER_NOW_THRESHOLD = 20;

// How stale a reading can be before we flag it
const STALE_MINUTES = 10;

interface PlantState {
  plant: Plant;
  latestLog: DryBackLog | null;
  currentWeight: number | null;
  wetWeight: number | null;
  drybackPercent: number | null;
  minutesSinceReading: number | null;
  isStale: boolean;
  status: "on-track" | "heads-up" | "water-now" | "no-data";
  isMirrored: boolean;
  mirroredSourceName?: string | null;
}

function getMinutesSince(isoTimestamp: string): number {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 1000 / 60);
}

function formatTimeAgo(minutes: number | null): string {
  if (minutes === null) return "no data";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function WeightDrybackCard({
  plants,
  dryBackLogs,
  isLoading = false,
  onRefresh,
  lastRefreshTime,
}: WeightDrybackCardProps) {
  // Build a map of the latest ESP32 log per plant
  const plantStates = useMemo<PlantState[]>(() => {
    // Group logs by plantId, keep only the latest
    const latestByPlant = new Map<string, DryBackLog>();
    for (const log of dryBackLogs) {
      if (!log.plantId) continue;
      // Only consider ESP32-sourced logs for "live" reading
      if (log.source !== "esp32" && log.source !== "loadcell") continue;
      const existing = latestByPlant.get(log.plantId);
      if (!existing || new Date(log.loggedAt) > new Date(existing.loggedAt)) {
        latestByPlant.set(log.plantId, log);
      }
    }

    return plants.map((plant) => {
      const latestLog = latestByPlant.get(plant.id) || null;

      // Handle mirrored plants: use the source plant's data
      let effectiveLog = latestLog;
      let effectiveWet = plant.wetWeight ?? null;
      let isMirrored = false;
      let mirroredSourceName: string | null = null;

      if (!latestLog && plant.mirrorPlantId) {
        const sourcePlant = plants.find((p) => p.id === plant.mirrorPlantId);
        const sourceLog = sourcePlant ? latestByPlant.get(sourcePlant.id) : null;
        if (sourceLog) {
          effectiveLog = sourceLog;
          effectiveWet = sourcePlant?.wetWeight ?? null;
          isMirrored = true;
          mirroredSourceName = sourcePlant?.name || null;
        }
      }

      const currentWeight = effectiveLog ? effectiveLog.weight : null;
      const wetWeight = effectiveWet ?? effectiveLog?.wetWeight ?? null;

      let drybackPercent: number | null = null;
      if (currentWeight !== null && wetWeight !== null && wetWeight > 0) {
        drybackPercent = Math.max(0, ((wetWeight - currentWeight) / wetWeight) * 100);
      }

      const minutesSinceReading = effectiveLog
        ? getMinutesSince(effectiveLog.loggedAt)
        : null;

      const isStale =
        minutesSinceReading === null || minutesSinceReading > STALE_MINUTES;

      let status: PlantState["status"] = "no-data";
      if (drybackPercent !== null) {
        if (drybackPercent >= WATER_NOW_THRESHOLD) status = "water-now";
        else if (drybackPercent >= HEADS_UP_THRESHOLD) status = "heads-up";
        else status = "on-track";
      }

      return {
        plant,
        latestLog: effectiveLog,
        currentWeight,
        wetWeight,
        drybackPercent,
        minutesSinceReading,
        isStale,
        status,
        isMirrored,
        mirroredSourceName,
      };
    });
  }, [plants, dryBackLogs]);

  if (plants.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Weight & Dryback
          </h2>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            live from load cell
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshTime && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              refreshed {lastRefreshTime}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Plant rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {plantStates.map((state) => (
          <PlantRow key={state.plant.id} state={state} />
        ))}
      </div>
    </div>
  );
}

function PlantRow({ state }: { state: PlantState }) {
  const {
    plant,
    currentWeight,
    wetWeight,
    drybackPercent,
    minutesSinceReading,
    isStale,
    status,
    isMirrored,
    mirroredSourceName,
  } = state;

  // Status styling
  const statusConfig = {
    "on-track": {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900/40",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: CheckCircle2,
      label: "On track",
      message: "No action needed",
    },
    "heads-up": {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/40",
      text: "text-amber-700 dark:text-amber-400",
      icon: Clock,
      label: "Heads up",
      message: "Plan to water in 4-6 hours",
    },
    "water-now": {
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-200 dark:border-red-900/40",
      text: "text-red-700 dark:text-red-400",
      icon: Droplet,
      label: "Water now",
      message: "Water to runoff",
    },
    "no-data": {
      bg: "bg-zinc-50 dark:bg-zinc-900/40",
      border: "border-zinc-200 dark:border-zinc-800",
      text: "text-zinc-500 dark:text-zinc-400",
      icon: AlertTriangle,
      label: "No data",
      message: "Waiting for load cell readings",
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <Link
      href={`/plants/${plant.id}`}
      className="block px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: plant info + weight */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {plant.name}
            </h3>
            {isMirrored && mirroredSourceName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-medium">
                🔄 mirroring {mirroredSourceName}
              </span>
            )}
            {isStale && currentWeight !== null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                <Clock className="size-2.5" />
                {formatTimeAgo(minutesSinceReading)}
              </span>
            )}
          </div>

          {currentWeight !== null ? (
            <div className="flex items-baseline gap-4 mt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {currentWeight.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">lbs</span>
              </div>
              {wetWeight !== null && (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  FC: {wetWeight.toFixed(2)} lbs
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {isMirrored
                ? "Waiting for source plant data"
                : "No readings yet"}
            </p>
          )}
        </div>

        {/* Right: dryback + status */}
        {drybackPercent !== null && (
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className={`text-2xl font-bold ${
                status === "water-now" ? "text-red-500" :
                status === "heads-up" ? "text-amber-500" :
                "text-emerald-500"
              }`}>
                {drybackPercent.toFixed(1)}%
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                dryback
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${statusConfig.bg} ${statusConfig.border}`}>
              <StatusIcon className={`size-3.5 ${statusConfig.text}`} />
              <span className={`text-xs font-semibold ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        )}

        {drybackPercent === null && currentWeight === null && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 shrink-0">
            <AlertTriangle className="size-3.5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              No data
            </span>
          </div>
        )}
      </div>

      {/* Status message */}
      {drybackPercent !== null && (
        <p className={`text-xs mt-2 ${statusConfig.text}`}>
          {statusConfig.message}
        </p>
      )}
    </Link>
  );
}
