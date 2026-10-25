// apps/frontend/src/components/dashboard/DailyCheckIn.tsx
"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { recordDailyCheckInLog } from "@/server/actions/check-in";
import { useRouter } from "next/navigation";
import { Scale, ThermometerSun, Droplet, Check, Loader2, Wind, Layers } from "lucide-react";
import { addManualClimateLog } from "@/server/actions/loggingreadings";

interface DailyCheckInProps {
  plants: {
    id: string;
    name: string;
    currentWeight: any;
    strain: string | null;
    roomId?: string | null;
  }[];
  rooms: {
    id: string;
    name: string;
  }[];
  defaultRoomId?: string;
  defaultPlantId?: string;
}

function calculateVPD(tempF: number, rh: number): number | null {
  if (isNaN(tempF) || isNaN(rh) || rh < 0 || rh > 100) return null;
  const tempC = (tempF - 32) * (5 / 9);
  const vpsat = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpact = vpsat * (rh / 100);
  const vpd = vpsat - vpact;
  return Math.max(0, parseFloat(vpd.toFixed(2)));
}

interface PlantEntryState {
  weight: number | "";
}

export function DailyCheckIn({
  rooms = [],
  plants = [],
  defaultRoomId,
}: DailyCheckInProps) {
  const router = useRouter();

  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    defaultRoomId && rooms.some((r) => r.id === defaultRoomId)
      ? defaultRoomId
      : rooms[0]?.id || "",
  );

  const [temp, setTemp] = useState<string>("");
  const [rh, setRh] = useState<string>("");
  const [plantStates, setPlantStates] = useState<Record<string, PlantEntryState>>({});
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const vpdValue = useMemo(() => {
    return calculateVPD(parseFloat(temp), parseFloat(rh));
  }, [temp, rh]);

  const roomPlants = useMemo(() => {
    return plants.filter(
      (p) => !p.roomId || p.roomId === selectedRoomId || selectedRoomId === "",
    );
  }, [plants, selectedRoomId]);

  // Reset plant states if the room changes
  useEffect(() => {
    setPlantStates({});
  }, [selectedRoomId]);

  const getPlantWeight = (plantId: string): number | "" => {
    return plantStates[plantId]?.weight ?? "";
  };

  const setPlantWeight = (plantId: string, weight: number | "") => {
    setPlantStates((prev) => ({
      ...prev,
      [plantId]: { weight },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        // 1. Save room climate, if entered
        const tempF = parseFloat(temp);
        const rhVal = parseFloat(rh);
        const hasClimate =
          !isNaN(tempF) && !isNaN(rhVal) && Boolean(selectedRoomId);

        if (hasClimate && selectedRoomId) {
          const tempC = ((tempF - 32) * 5) / 9;
          await addManualClimateLog({
            roomId: selectedRoomId,
            temperature: tempC,
            humidity: rhVal,
          });
        }

        // 2. Save per-plant weight logs — only for plants with a weight entered
        let plantLogsRecorded = 0;
        for (const plant of roomPlants) {
          const weight = getPlantWeight(plant.id);
          const hasWeight = typeof weight === "number" && weight > 0;
          if (!hasWeight) continue;

          const result = await recordDailyCheckInLog({
            plantId: plant.id,
            weight: weight as number,
            watered: false,
            fed: false,
            trainingEvent: "None",
          });
          if (!result.success) {
            throw new Error(result.error || `Failed log for ${plant.name}`);
          }
          plantLogsRecorded++;
        }

        if (!hasClimate && plantLogsRecorded === 0) {
          setFeedback({
            type: "error",
            message: "Enter room climate or at least one plant weight before saving.",
          });
          return;
        }

        setFeedback({
          type: "success",
          message: "Check-in saved. Redirecting…",
        });
        setPlantStates({});
        setTemp("");
        setRh("");
        router.push("/dashboard?logged=true");
        router.refresh();
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err.message || "Failed to save check-in.",
        });
      }
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-canopy dark:text-emerald-400">
          Daily Check-In
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Weight, room climate, save.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Room selector */}
        <div>
          <label
            htmlFor="room-selector"
            className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5"
          >
            <Layers className="size-4 text-canopy dark:text-emerald-400" />
            Room
          </label>
          <select
            id="room-selector"
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
          >
            {rooms.length === 0 ? (
              <option value="" disabled>
                No rooms defined
              </option>
            ) : (
              rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Room climate */}
        <div className="border rounded-xl p-4 bg-mist/20 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Room Climate (optional — skip if sensors are reporting)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mt-3">
            <div>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ThermometerSun className="size-4 text-clay dark:text-orange-400" />
                Temp (°F)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="75.5"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full p-2 bg-white dark:bg-zinc-900 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Droplet className="size-4 text-blue-500" />
                RH (%)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="60.0"
                value={rh}
                onChange={(e) => setRh(e.target.value)}
                className="w-full p-2 bg-white dark:bg-zinc-900 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
              />
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <Wind className="size-3 text-canopy dark:text-emerald-400" />
                VPD
              </span>
              <span className="text-lg font-black text-canopy dark:text-emerald-400 mt-0.5">
                {vpdValue !== null ? `${vpdValue} kPa` : "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Per-plant weights */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
            Plants in Room ({roomPlants.length})
          </h3>

          {roomPlants.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl py-8 px-6 text-center bg-white dark:bg-zinc-900/70">
              <div className="text-3xl">🌱</div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No plants in this room. Add one on the Plants page.
              </p>
            </div>
          ) : (
            roomPlants.map((plant) => {
              const currentWeight = plant.currentWeight
                ? Number(plant.currentWeight)
                : null;
              const entered = getPlantWeight(plant.id);
              return (
                <div
                  key={plant.id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white dark:bg-zinc-900/80 shadow-sm transition-all hover:border-canopy/40 dark:hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-graphite dark:text-zinc-100">
                      {plant.name}
                    </span>
                    {currentWeight !== null && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Current: {currentWeight.toFixed(1)} lbs
                      </span>
                    )}
                  </div>
                  <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Scale className="size-3.5 text-canopy dark:text-emerald-400" />
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={
                      currentWeight !== null
                        ? `Current: ${currentWeight.toFixed(1)}`
                        : "e.g. 14.2"
                    }
                    value={entered}
                    onChange={(e) =>
                      setPlantWeight(
                        plant.id,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full p-2 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500"
                  />
                </div>
              );
            })
          )}
        </div>

        {feedback && (
          <p
            className={`text-center text-xs font-bold ${
              feedback.type === "success" ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || roomPlants.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-canopy dark:bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-canopy/90 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Check className="size-5" />
              <span>Save Check-In</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}