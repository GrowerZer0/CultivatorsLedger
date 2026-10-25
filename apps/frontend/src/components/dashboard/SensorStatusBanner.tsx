"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";

export interface SensorStatus {
  id: string;
  name: string;
  type: string;
  lastPingAt: string | null; // ISO
}

interface SensorStatusBannerProps {
  sensors: SensorStatus[];
}

// Thresholds in minutes
const OFFLINE_THRESHOLD_MIN = {
  weight: 15,
  environmental: 30,
  unknown: 30,
} as const;

function getThresholdMinutes(type: string): number {
  const t = type.toLowerCase();
  if (t.includes("load") || t.includes("weight") || t.includes("esp32")) {
    return OFFLINE_THRESHOLD_MIN.weight;
  }
  if (t.includes("sht") || t.includes("env") || t.includes("climate")) {
    return OFFLINE_THRESHOLD_MIN.environmental;
  }
  return OFFLINE_THRESHOLD_MIN.unknown;
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function SensorStatusBanner({ sensors }: SensorStatusBannerProps) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  // On mount, load any per-sensor dismissal for the current lastPingAt value.
  // Keying by `${id}:${lastPingAt}` means if the sensor recovers and then dies again,
  // the banner reappears — dismissal doesn't stick forever.
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const s of sensors) {
      const key = `sensor-offline-dismissed:${s.id}:${s.lastPingAt ?? "never"}`;
      if (typeof window !== "undefined" && sessionStorage.getItem(key) === "1") {
        next[s.id] = true;
      }
    }
    setDismissed(next);
  }, [sensors]);

  const dismiss = (sensor: SensorStatus) => {
    const key = `sensor-offline-dismissed:${sensor.id}:${sensor.lastPingAt ?? "never"}`;
    sessionStorage.setItem(key, "1");
    setDismissed((prev) => ({ ...prev, [sensor.id]: true }));
  };

  const now = Date.now();
  const offline = sensors
    .filter((s) => !dismissed[s.id])
    .map((s) => {
      const last = s.lastPingAt ? new Date(s.lastPingAt).getTime() : null;
      const ageMin = last ? Math.floor((now - last) / 60000) : Infinity;
      const threshold = getThresholdMinutes(s.type);
      return { sensor: s, ageMin, threshold, isOffline: ageMin > threshold };
    })
    .filter((x) => x.isOffline);

  if (offline.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-2">
      {offline.map(({ sensor, ageMin, threshold }) => (
        <div key={sensor.id} className="flex items-start gap-3">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              <span className="font-bold">{sensor.name}</span>{" "}
              {Number.isFinite(ageMin)
                ? `hasn't reported in ${formatAge(ageMin)}`
                : "has never reported"}
              <span className="text-amber-700 dark:text-amber-400 font-normal">
                {" "}
                — check power and WiFi
              </span>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Expected every {threshold} min.{" "}
              <Link
                href="/settings/hardware"
                className="underline hover:no-underline"
              >
                Sensor settings
              </Link>
            </p>
          </div>
          <button
            onClick={() => dismiss(sensor)}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
            title="Dismiss for this session"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}