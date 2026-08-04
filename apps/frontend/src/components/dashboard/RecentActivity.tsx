//apps/frontend/src/components/dashboard/RecentActivity.tsx

"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Scale,
  ThermometerSun,
  Droplet,
  Wind,
  CheckCircle2,
  Sprout,
} from "lucide-react";

export type ActivityItem = {
  id: string;
  type: "plant" | "climate";
  timestamp: string | Date;
  label: string;
  detail: string;
  metadata?: {
    weight?: number;
    temperatureF?: number;
    humidity?: number;
    vpd?: number;
    watered?: boolean;
    fed?: boolean;
    training?: string;
  };
};

interface RecentActivityProps {
  items: ActivityItem[];
  maxItems?: number;
}

export function RecentActivity({ items, maxItems = 5 }: RecentActivityProps) {
  // Sort by timestamp (newest first)
  const sorted = [...items]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, maxItems);

  if (sorted.length === 0) {
    return (
      <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sprout className="size-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recent Activity
          </h3>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
          No activity yet. Start by logging a check‑in.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Sprout className="size-4" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Recent Activity
        </h3>
        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
          {sorted.length} new
        </span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((item) => {
          const timeAgo = formatDistanceToNow(new Date(item.timestamp), {
            addSuffix: true,
          });

          const iconMap = {
            plant: <Scale className="size-3.5 text-emerald-500" />,
            climate: <ThermometerSun className="size-3.5 text-orange-500" />,
          };

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 hover:border-emerald-500/30 transition-all"
            >
              <div className="shrink-0 mt-0.5">
                {iconMap[item.type] || iconMap.plant}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {item.label}
                  </p>
                  <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    {timeAgo}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                  {item.detail}
                </p>

                {item.metadata && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {item.metadata.weight !== undefined && (
                      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                        {item.metadata.weight.toFixed(1)} lbs
                      </span>
                    )}
                    {item.metadata.temperatureF !== undefined && (
                      <span className="text-[10px] font-mono text-orange-500 bg-white dark:bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                        {item.metadata.temperatureF}°F
                      </span>
                    )}
                    {item.metadata.humidity !== undefined && (
                      <span className="text-[10px] font-mono text-blue-500 bg-white dark:bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                        {item.metadata.humidity}%
                      </span>
                    )}
                    {item.metadata.vpd !== undefined && (
                      <span className="text-[10px] font-mono text-emerald-500 bg-white dark:bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                        {item.metadata.vpd.toFixed(2)} kPa
                      </span>
                    )}
                    {item.metadata.watered && (
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        💧 Watered
                      </span>
                    )}
                    {item.metadata.fed && (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        🧪 Fed
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 mt-0.5">
                <CheckCircle2 className="size-3.5 text-emerald-500/70" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}