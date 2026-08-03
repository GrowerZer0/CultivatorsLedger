// apps/frontend/src/components/facility/RoomCard.tsx

"use client";

import Link from "next/link";
import { ThermometerSun, Droplet, Wind, Users } from "lucide-react";

type RoomCardProps = {
  id: string;
  name: string;
  type: string;
  plantCount: number;
  latestReading?: {
    temperatureF: number | null;
    humidity: number | null;
    vpd: number | null;
  };
};

export function RoomCard({ id, name, type, plantCount, latestReading }: RoomCardProps) {
  return (
    <Link
      href={`/rooms/${id}`}
      className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition hover:border-emerald-500 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{type}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Users className="size-3.5" />
          <span>{plantCount}</span>
        </div>
      </div>

      {latestReading ? (
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-orange-500">
            <ThermometerSun className="size-3.5" />
            {latestReading.temperatureF !== null && latestReading.temperatureF !== undefined
              ? `${Math.round(Number(latestReading.temperatureF))}°F`
              : "--"}
          </span>
          <span className="flex items-center gap-1 text-blue-500">
            <Droplet className="size-3.5" />
            {latestReading.humidity !== null && latestReading.humidity !== undefined
              ? `${Math.round(Number(latestReading.humidity))}%`
              : "--"}
          </span>
          <span className="flex items-center gap-1 text-emerald-500">
            <Wind className="size-3.5" />
            {latestReading.vpd !== null && latestReading.vpd !== undefined
              ? `${Number(latestReading.vpd).toFixed(1)} kPa`
              : "--"}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">No readings yet</p>
      )}
    </Link>
  );
}