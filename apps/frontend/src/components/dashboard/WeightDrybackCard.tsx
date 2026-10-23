"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Scale, Droplet, Clock, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

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

const HEADS_UP_THRESHOLD = 15;
const WATER_NOW_THRESHOLD = 20;
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
  chartData: Array<{ time: string; dryback: number }>;
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
  return `${Math.floor(hours / 24)}d ago`;
}

export function WeightDrybackCard({
  plants,
  dryBackLogs,
  isLoading = false,
  onRefresh,
  lastRefreshTime,
}: WeightDrybackCardProps) {
  const plantStates = useMemo<PlantState[]>(() => {
    const latestByPlant = new Map<string, DryBackLog>();
    const logsByPlant = new Map<string, DryBackLog[]>();

    for (const log of dryBackLogs) {
      if (!log.plantId) continue;
      if (log.source !== "esp32" && log.source !== "loadcell") continue;

      const existing = latestByPlant.get(log.plantId);
      if (!existing || new Date(log.loggedAt) > new Date(existing.loggedAt)) {
        latestByPlant.set(log.plantId, log);
      }

      const arr = logsByPlant.get(log.plantId) || [];
      arr.push(log);
      logsByPlant.set(log.plantId, arr);
    }

    // Sort each plant's logs ascending by time for chart
    logsByPlant.forEach((arr) => {
      arr.sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
    });

    return plants.map((plant) => {
      const latestLog = latestByPlant.get(plant.id) || null;
      let effectiveLog = latestLog;
      let effectiveWet = plant.wetWeight ?? null;
      let isMirrored = false;
      let mirroredSourceName: string | null = null;
      let sourcePlantId = plant.id;

      if (!latestLog && plant.mirrorPlantId) {
        const sourcePlant = plants.find((p) => p.id === plant.mirrorPlantId);
        const sourceLog = sourcePlant ? latestByPlant.get(sourcePlant.id) : null;
        if (sourceLog) {
          effectiveLog = sourceLog;
          effectiveWet = sourcePlant?.wetWeight ?? null;
          isMirrored = true;
          mirroredSourceName = sourcePlant?.name || null;
          sourcePlantId = sourcePlant!.id;
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
      const isStale = minutesSinceReading === null || minutesSinceReading > STALE_MINUTES;

      let status: PlantState["status"] = "no-data";
      if (drybackPercent !== null) {
        if (drybackPercent >= WATER_NOW_THRESHOLD) status = "water-now";
        else if (drybackPercent >= HEADS_UP_THRESHOLD) status = "heads-up";
        else status = "on-track";
      }

      // Build chart data — last 7 days, up to 50 points
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const sourceLogs = logsByPlant.get(sourcePlantId) || [];
      const recent = sourceLogs.filter(
        (log) => new Date(log.loggedAt).getTime() >= sevenDaysAgo
      );

      // Downsample if too many
      const step = Math.max(1, Math.floor(recent.length / 50));
      const sampled = recent.filter((_, i) => i % step === 0);

      const chartData = sampled.map((log) => {
        const w = log.weight;
        const ww = wetWeight ?? log.wetWeight;
        const db = ww > 0 ? Math.max(0, ((ww - w) / ww) * 100) : 0;
        return {
          time: new Date(log.loggedAt).toLocaleString([], {
            month: "numeric",
            day: "numeric",
            hour: "numeric",
          }),
          dryback: Math.round(db * 10) / 10,
        };
      });

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
        chartData,
      };
    });
  }, [plants, dryBackLogs]);

  if (plants.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Weight &amp; Dryback
          </h2>
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
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

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
    chartData,
  } = state;

  const statusConfig = {
    "on-track": {
      text: "text-emerald-500",
      label: "On track",
      icon: CheckCircle2,
    },
    "heads-up": {
      text: "text-amber-500",
      label: "Heads up",
      icon: Clock,
    },
    "water-now": {
      text: "text-red-500",
      label: "Water now",
      icon: Droplet,
    },
    "no-data": {
      text: "text-zinc-500",
      label: "No data",
      icon: AlertTriangle,
    },
  }[status];

  const StatusIcon = statusConfig.icon;
  const chartColor =
    status === "water-now"
      ? "#ef4444"
      : status === "heads-up"
      ? "#f59e0b"
      : "#10b981";

  return (
    <div className="px-5 py-4">
      <Link href={`/plants/${plant.id}`} className="block">
        {/* Top row: name + weight + dryback */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {plant.name}
              </h3>
              {isMirrored && mirroredSourceName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-medium">
                  🔄 {mirroredSourceName}
                </span>
              )}
              {isStale && currentWeight !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Clock className="size-2.5" />
                  {formatTimeAgo(minutesSinceReading)}
                </span>
              )}
            </div>
            {currentWeight !== null && (
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {Number(currentWeight).toFixed(2)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">lbs</span>
                {wetWeight !== null && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    FC {Number(wetWeight).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>

          {drybackPercent !== null && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className={`text-2xl font-bold ${statusConfig.text}`}>
                  {Number(drybackPercent).toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  dryback
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${statusConfig.text} bg-zinc-50 dark:bg-zinc-800`}>
                <StatusIcon className="size-3.5" />
                <span className="text-xs font-semibold">{statusConfig.label}</span>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Mini chart */}
      {chartData.length > 1 && (
        <div className="mt-3 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#3f3f46",
                  color: "#fff",
                  fontSize: "11px",
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "dryback"]}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <ReferenceLine
                y={HEADS_UP_THRESHOLD}
                stroke="#f59e0b"
                strokeDasharray="2 4"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={WATER_NOW_THRESHOLD}
                stroke="#ef4444"
                strokeDasharray="2 4"
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="dryback"
                stroke={chartColor}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}