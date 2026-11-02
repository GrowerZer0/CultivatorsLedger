"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Sprout, AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";

interface PickerPlant {
    id: string;
    name: string;
    strain: string | null;
    stage: string | null;
    wetWeight: number | null;      // FC, lbs
    currentWeight: number | null;  // last reading, lbs
    thumbnailUrl: string | null;
}

interface PlantPickerProps {
    plants: PickerPlant[];
    returnTo: string; // e.g. "/dashboard"
}

export function PlantPicker({ plants, returnTo }: PlantPickerProps) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return plants;
        return plants.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.strain ?? "").toLowerCase().includes(q),
        );
    }, [plants, query]);

    // Compute a quick status per plant — same thresholds as PlantStatusList
    const withStatus = filtered.map((p) => {
        const hasFc = p.wetWeight !== null && p.wetWeight > 0;
        const wet = p.wetWeight ?? 0;
        const cur = p.currentWeight;
        let dryback: number | null = null;
        if (hasFc && cur !== null) {
            dryback = Math.max(0, ((wet - cur) / wet) * 100);
        }
        const useGrams = p.stage === "seedling";
        const display = (lbs: number | null) =>
            lbs === null
                ? "—"
                : useGrams
                    ? `${(lbs * 453.592).toFixed(1)} g`
                    : `${lbs.toFixed(2)} lbs`;
        return { ...p, hasFc, dryback, useGrams, weightDisplay: display(cur), fcDisplay: display(p.wetWeight) };
    });

if (plants.length === 0) {
  return (
    <EmptyState
      icon={Sprout}
      title="No plants to log against"
      description="Start a grow first, then come back here to log a reading."
      variant="compact"
      action={{
        label: "Go to Dashboard",
        href: "/dashboard",
      }}
    />
  );
}

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search plants by name or strain…"
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
            </div>

            {withStatus.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-6">
                    No plants match "{query}".
                </p>
            ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                    {withStatus.map((p) => (
                        <Link
                            key={p.id}
                            href={`/check-in?plantId=${p.id}&returnTo=${encodeURIComponent(returnTo)}&via=picker`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                            <div className="size-11 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                {p.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.thumbnailUrl} alt={p.name} className="size-11 object-cover" />
                                ) : (
                                    <div className="size-11 grid place-items-center text-zinc-400 text-xs">—</div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                    {p.name}
                                </p>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                                    <span className="capitalize">{p.stage ?? "—"}</span>
                                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                                    <span className="font-mono">{p.weightDisplay}</span>
                                    {p.fcDisplay !== "—" && (
                                        <span className="font-mono text-[10px]">FC {p.fcDisplay}</span>
                                    )}
                                </p>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                                {!p.hasFc ? (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <AlertTriangle className="size-3" />
                                        No FC
                                    </span>
                                ) : p.dryback !== null ? (
                                    <span
                                        className={`text-xs font-bold font-mono ${p.dryback >= 20
                                                ? "text-red-500"
                                                : p.dryback >= 15
                                                    ? "text-amber-500"
                                                    : "text-emerald-500"
                                            }`}
                                    >
                                        {p.dryback.toFixed(1)}%
                                    </span>
                                ) : (
                                    <CheckCircle2 className="size-3.5 text-zinc-300" />
                                )}
                                <Scale className="size-4 text-emerald-500" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}