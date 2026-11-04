"use client";

import Link from "next/link";
import {
    Scale,
    Lightbulb,
    Thermometer,
    AlertCircle,
    ChevronRight,
} from "lucide-react";

interface PlantHardwareCardProps {
    plantId: string;
    plantName: string;
    // Scale (per-plant)
    scale: {
        id: string;
        name: string;
        type: string;
    } | null;
    // Light (per-plant)
    light: {
        id: string;
        name: string;
        wattage: number;
        dimmerPercent: number;
        distanceInches: number | null;
    } | null;
    // Room sensors (read-only context)
    roomId: string | null;
    roomName: string | null;
    roomClimate: {
        temperatureF: number;
        humidity: number;
        timestamp: string;
    } | null;
    // Callback to open "Assign Scale" modal
    onAssignScale: () => void;
}

export function PlantHardwareCard({
    plantId,
    plantName,
    scale,
    light,
    roomId,
    roomName,
    roomClimate,
    onAssignScale,
}: PlantHardwareCardProps) {
    const minutesSinceClimate = roomClimate
        ? Math.floor(
            (Date.now() - new Date(roomClimate.timestamp).getTime()) / 60000,
        )
        : null;
    const climateIsFresh =
        minutesSinceClimate !== null && minutesSinceClimate < 15;

    // Nothing attached? Show the "add hardware" hint.
    if (!scale && !light && !roomName) {
        return (
            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                            Hardware
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            No scale, light, or room assigned to this plant yet.
                        </p>
                    </div>
                    <button
                        onClick={onAssignScale}
                        className="px-3 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg transition-colors"
                    >
                        Assign Scale
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">

            {/* Scale (per-plant) */}
            {scale && (
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Scale className="size-4 text-emerald-500" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                Scale
                            </div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                                {scale.name}
                            </div>
                        </div>
                    </div>
                    <Link
                        href={`/settings/hardware/${scale.id}`}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                        Configure
                        <ChevronRight className="size-3" />
                    </Link>
                </div>
            )}

            {/* Light (per-plant) */}
            {light && (
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Lightbulb className="size-4 text-amber-500" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                Light
                            </div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                                {light.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                                {light.wattage}W @ {light.dimmerPercent}%
                                {light.distanceInches !== null && ` · ${light.distanceInches}"`}
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/settings/hardware/lights"
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                        Edit
                        <ChevronRight className="size-3" />
                    </Link>
                </div>
            )}

            {/* Room sensors (read-only context) */}
            {roomName && roomId && (
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Thermometer className="size-4 text-blue-500" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                Room Environment
                            </div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                                {roomName}
                            </div>
                            {roomClimate ? (
                                <div
                                    className={`text-[11px] mt-0.5 flex items-center gap-1 ${climateIsFresh
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-amber-600 dark:text-amber-400"
                                        }`}
                                >
                                    {roomClimate.temperatureF.toFixed(1)}°F ·{" "}
                                    {roomClimate.humidity.toFixed(0)}% RH
                                    <span className="text-zinc-400 ml-1">
                                        {climateIsFresh
                                            ? "(live)"
                                            : minutesSinceClimate !== null &&
                                                minutesSinceClimate < 1440
                                                ? `(${Math.floor(minutesSinceClimate / 60)}h ago)`
                                                : minutesSinceClimate !== null
                                                    ? `(${Math.floor(minutesSinceClimate / 1440)}d ago)`
                                                    : ""}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
                                    <AlertCircle className="size-3" />
                                    No sensor data
                                </div>
                            )}
                        </div>
                    </div>
                    <Link
                        href={`/rooms/${roomId}`}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        View Room
                        <ChevronRight className="size-3" />
                    </Link>
                </div>
            )}

            {/* Add scale button (only if a scale isn't assigned yet) */}
            {!scale && (
                <div className="p-4">
                    <button
                        onClick={onAssignScale}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                        + Assign a scale to {plantName}
                    </button>
                </div>
            )}
        </div>
    );
}