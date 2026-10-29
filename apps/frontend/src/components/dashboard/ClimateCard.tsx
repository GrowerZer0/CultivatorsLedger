"use client";

import { useEffect, useState } from "react";
import { Thermometer, Droplet, Wind, RefreshCw } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceArea,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { ClimateReading, ClimatePoint } from "@/server/actions/climate";
import { getEnvironmentTargets } from "@/lib/cultivation-rules";

function getMinutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000 / 60);
}

function formatAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface ClimateCardProps {
  reading: ClimateReading | null;
  trend?: ClimatePoint[];
  stage?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function ClimateCard({ reading, trend = [], stage, onRefresh, isLoading }: ClimateCardProps) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  const targets = getEnvironmentTargets(stage as any);
  const VPD_MIN = targets.vpdMin;
  const VPD_MAX = targets.vpdMax;
  useEffect(() => {
    if (!reading) return;
    const update = () => setMinutesAgo(getMinutesAgo(reading.timestamp));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [reading]);

  if (!reading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Thermometer className="size-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Environment</h2>
          </div>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Waiting for sensor data...</p>
        </div>
      </div>
    );
  }

  const vpdStatus =
    reading.vpd < VPD_MIN ? "low" : reading.vpd > VPD_MAX ? "high" : "ok";
  const vpdColor =
    vpdStatus === "ok"
      ? "text-emerald-500"
      : vpdStatus === "high"
      ? "text-amber-500"
      : "text-blue-400";
  const vpdBg =
    vpdStatus === "ok"
      ? "bg-emerald-500/10"
      : vpdStatus === "high"
      ? "bg-amber-500/10"
      : "bg-blue-500/10";
  const isStale = minutesAgo > 10;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Thermometer className="size-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Environment</h2>
          {reading.roomName && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              · {reading.roomName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] ${
              isStale ? "text-amber-500" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {formatAgo(minutesAgo)}
          </span>
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

      {/* Readings row */}
      <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
        <div className="px-4 py-4">
          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">
            <Thermometer className="size-3" />
            Temp
          </div>
          <div className="mt-1">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {Number(reading.temperatureF).toFixed(1)}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">°F</span>
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {Number(reading.temperatureC).toFixed(1)}°C
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">
            <Droplet className="size-3" />
            RH
          </div>
          <div className="mt-1">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {Number(reading.humidity).toFixed(0)}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">%</span>
          </div>
        </div>

        <div className={`px-4 py-4 ${vpdBg}`}>
          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">
            <Wind className="size-3" />
            VPD
          </div>
          <div className="mt-1">
            <span className={`text-2xl font-bold ${vpdColor}`}>
              {Number(reading.vpd).toFixed(2)}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">kPa</span>
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Target {VPD_MIN}–{VPD_MAX}
          </div>
        </div>
      </div>

      {/* VPD trend chart */}
      {trend.length > 1 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1">
            VPD trend · last 24h
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <ReferenceArea
                  y1={VPD_MIN}
                  y2={VPD_MAX}
                  fill="#10B981"
                  fillOpacity={0.1}
                  stroke="none"
                />
                <XAxis
                  dataKey="time"
                  stroke="#52525b"
                  fontSize={9}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={9}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#3f3f46",
                    color: "#fff",
                    fontSize: "11px",
                  }}
                  formatter={(value) => [`${Number(value).toFixed(2)} kPa`, "VPD"]}
                />
                <Line
                  type="monotone"
                  dataKey="vpd"
                  stroke="#10B981"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}