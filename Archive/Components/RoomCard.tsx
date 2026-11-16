"use client";

import Link from "next/link";
import { Trash2, Home, ThermometerSun, Droplet, Wind, Plus } from "lucide-react";

interface RoomCardProps {
  id: string;
  name: string;
  type: string;
  plantCount: number;
  latestReading: {
    temperatureF?: number | null;
    humidity?: number | null;
    vpd?: number | null;
  } | null;
  onDelete?: (id: string, name: string) => void;
  isDeleting?: boolean;
  onAddPlant?: () => void;
}

export function RoomCard({ 
  id, 
  name, 
  type, 
  plantCount, 
  latestReading,
  onDelete,
  isDeleting,
  onAddPlant,
}: RoomCardProps) {
  const tempFormatted = latestReading?.temperatureF !== undefined && latestReading?.temperatureF !== null
    ? `${Math.round(latestReading.temperatureF)}°F`
    : "--";
  const rhFormatted = latestReading?.humidity !== undefined && latestReading?.humidity !== null
    ? `${Math.round(latestReading.humidity)}%`
    : "--";
  const vpdFormatted = latestReading?.vpd !== undefined && latestReading?.vpd !== null
    ? `${latestReading.vpd.toFixed(1)} kPa`
    : "--";

  return (
    <Link href={`/rooms/${id}`} className="block group">
      <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Home className="size-4 text-zinc-500" />
              <h3 className="font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                {name}
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{type}</p>
            <p className="text-xs text-zinc-400 mt-2">
              {plantCount} plant{plantCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {onAddPlant && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddPlant();
                }}
                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 transition-colors"
                title="Add plant to room"
              >
                <Plus className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(id, name);
                }}
                disabled={isDeleting}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Delete room"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Latest readings preview */}
        <div className="mt-3 pt-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-zinc-400">
              <ThermometerSun className="size-3 text-orange-400" />
              <span className="text-white">{tempFormatted}</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400">
              <Droplet className="size-3 text-blue-400" />
              <span className="text-white">{rhFormatted}</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400">
              <Wind className="size-3 text-emerald-400" />
              <span className="text-white">{vpdFormatted}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 text-xs text-emerald-400/70 group-hover:text-emerald-400 transition-colors">
          Click to view details →
        </div>
      </div>
    </Link>
  );
}
