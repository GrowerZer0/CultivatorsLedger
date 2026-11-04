"use client";

import Link from "next/link";
import {
  Layers,
  Thermometer,
  Droplet,
  Sun,
  ArrowRight,
  AlertCircle,
  Trash2,
} from "lucide-react";

interface RoomSummaryProps {
  room: {
    id: string;
    name: string;
    targetTempF: number | null;
    targetRH: number | null;
    lightOnTime: string | null;
    lightOffTime: string | null;
  };
  plantCount: number;
  latestReading: {
    temperatureF: number;
    humidity: number;
    timestamp: string;
  } | null;
  lights: Array<{
    id: string;
    name: string;
    wattage: number;
    dimmerPercent: number;
  }>;
  variant?: "card" | "compact";
  onDelete?: (roomId: string, roomName: string) => void;
  isDeleting?: boolean;
}

export function RoomSummary({
  room,
  plantCount,
  latestReading,
  lights,
  variant = "card",
  onDelete,
  isDeleting = false,
}: RoomSummaryProps) {
  const isCompact = variant === "compact";

  const minutesSinceReading = latestReading
    ? Math.floor(
        (Date.now() - new Date(latestReading.timestamp).getTime()) / 60000,
      )
    : null;
  const isFresh = minutesSinceReading !== null && minutesSinceReading < 15;

  const temp = latestReading?.temperatureF ?? null;
  const rh = latestReading?.humidity ?? null;

  const envIsOutOfRange =
    (temp !== null && room.targetTempF !== null && Math.abs(temp - room.targetTempF) > 5) ||
    (rh !== null && room.targetRH !== null && Math.abs(rh - room.targetRH) > 10);

  if (isCompact) {
    return (
      <Link
        href={`/rooms/${room.id}`}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-emerald-500/60 transition-colors group"
      >
        <Layers className="size-4 text-zinc-500 shrink-0 group-hover:text-emerald-500 transition-colors" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
            {room.name}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <span>{plantCount} {plantCount === 1 ? "plant" : "plants"}</span>
            {latestReading && (
              <>
                <span>·</span>
                <span className={isFresh ? "text-emerald-500" : "text-amber-500"}>
                  {temp?.toFixed(0)}°F / {rh?.toFixed(0)}%
                </span>
              </>
            )}
          </div>
        </div>
        <ArrowRight className="size-3.5 text-zinc-400 shrink-0 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
      </Link>
    );
  }

  return (
    <div className="relative group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-emerald-500/60 transition-colors">
      {/* Wrap the content in a Link so the whole card is clickable */}
      <Link href={`/rooms/${room.id}`} className="block">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pr-8">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-emerald-500" />
            <h3 className="font-bold text-zinc-900 dark:text-white">
              {room.name}
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {plantCount} {plantCount === 1 ? "plant" : "plants"}
            </span>
          </div>
          {envIsOutOfRange && (
            <AlertCircle className="size-4 text-amber-500" />
          )}
        </div>

        {/* Environment */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Thermometer className="size-4 text-orange-500" />
            <div>
              <div className="font-mono font-bold text-zinc-900 dark:text-white">
                {temp !== null ? `${temp.toFixed(1)}°F` : "—"}
              </div>
              <div className="text-[10px] text-zinc-500">
                {room.targetTempF !== null
                  ? `target ${room.targetTempF}°F`
                  : "no target"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Droplet className="size-4 text-blue-500" />
            <div>
              <div className="font-mono font-bold text-zinc-900 dark:text-white">
                {rh !== null ? `${rh.toFixed(0)}%` : "—"}
              </div>
              <div className="text-[10px] text-zinc-500">
                {room.targetRH !== null ? `target ${room.targetRH}%` : "no target"}
              </div>
            </div>
          </div>
        </div>

        {/* Reading freshness */}
        {latestReading ? (
          <div
            className={`text-[10px] mb-3 ${
              isFresh
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {isFresh
              ? "Live"
              : minutesSinceReading !== null && minutesSinceReading < 1440
                ? `${Math.floor(minutesSinceReading / 60)}h ago`
                : minutesSinceReading !== null
                  ? `${Math.floor(minutesSinceReading / 1440)}d ago`
                  : ""}
          </div>
        ) : (
          <div className="text-[10px] text-zinc-500 mb-3">No sensor data</div>
        )}

        {/* Lights */}
        {lights.length > 0 && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            {lights.map((light) => (
              <div
                key={light.id}
                className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <Sun className="size-3.5 text-amber-500" />
                <span className="font-semibold">{light.name}</span>
                <span className="text-zinc-400">
                  · {light.wattage}W @ {light.dimmerPercent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Link>

      {/* Delete button (only shows on hover) */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(room.id, room.name);
          }}
          disabled={isDeleting}
          className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-all disabled:opacity-50"
          title="Delete room"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}