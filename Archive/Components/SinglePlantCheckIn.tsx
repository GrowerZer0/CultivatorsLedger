"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  Droplet,
  Sprout,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { recordDailyCheckInLog } from "@/server/actions/check-in";

interface SinglePlantCheckInProps {
  plant: {
    id: string;
    name: string;
    stage: string | null;
    strain: string | null;
    wetWeight: number | null;      // Field Capacity, lbs
    currentWeight: number | null;  // last logged weight, lbs
    lastSourceDevice: string | null; // "small" | "esp32" | null
  };
  returnTo?: string;

}

const TRAINING_EVENTS = ["None", "Top", "Defoliate", "LST", "Flip", "Harvest"] as const;
type TrainingEvent = (typeof TRAINING_EVENTS)[number];

const HEADS_UP_THRESHOLD = 15;
const WATER_NOW_THRESHOLD = 20;

export function SinglePlantCheckIn({ plant, returnTo }: SinglePlantCheckInProps) {
  const router = useRouter();
  const backHref = returnTo ?? `/plants/${plant.id}`;
  const [isPending, startTransition] = useTransition();

  // Unit is determined by stage + last source device (same rule as PlantStatusList)
  const useGrams =
    plant.stage === "seedling" ||
    plant.lastSourceDevice?.toLowerCase().includes("small") ||
    false;
  const unitLabel = useGrams ? "g" : "lbs";
  const toDisplay = (lbs: number | null) =>
    lbs === null ? null : useGrams ? lbs * 453.592 : lbs;

  const fcDisplay = toDisplay(plant.wetWeight);
  const lastDisplay = toDisplay(plant.currentWeight);

  const [weightInput, setWeightInput] = useState<string>("");
  const [watered, setWatered] = useState(false);
  const [fed, setFed] = useState(false);
  const [trainingEvent, setTrainingEvent] = useState<TrainingEvent>("None");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasFc = plant.wetWeight !== null && plant.wetWeight > 0;

  // Live dryback preview computed from typed value
  const preview = useMemo(() => {
    if (!hasFc) return { kind: "none" as const };
    const typed = parseFloat(weightInput);
    if (!Number.isFinite(typed) || typed <= 0) return { kind: "none" as const };
    const weightLbs = useGrams ? typed / 453.592 : typed;
    const wet = plant.wetWeight!;
    if (weightLbs > wet) {
      return { kind: "error" as const, error: "Weight exceeds field capacity." };
    }
    const pct = Math.max(0, ((wet - weightLbs) / wet) * 100);
    return {
      kind: "ok" as const,
      pct,
      label:
        pct >= WATER_NOW_THRESHOLD
          ? "Water now"
          : pct >= HEADS_UP_THRESHOLD
            ? "Heads up"
            : "On track",
      color:
        pct >= WATER_NOW_THRESHOLD
          ? "text-red-500"
          : pct >= HEADS_UP_THRESHOLD
            ? "text-amber-500"
            : "text-emerald-500",
    };
  }, [weightInput, plant.wetWeight, useGrams, hasFc]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!hasFc) {
      setError(
        "Field capacity isn't set for this plant. Open Scale Settings on the plant page and set FC before logging a reading.",
      );
      return;
    }

    const typed = parseFloat(weightInput);
    if (!Number.isFinite(typed) || typed <= 0) {
      setError(`Enter a positive weight in ${unitLabel}.`);
      return;
    }

    startTransition(async () => {
      const res = await recordDailyCheckInLog({
        plantId: plant.id,
        weight: typed,
        unit: useGrams ? "g" : "lbs",
        watered,
        fed,
        trainingEvent,
        notes: notes.trim() || null,
      });

      if (!res.success) {
        setError(res.error || "Failed to save reading.");
        return;
      }

      setSuccess(true);
      // Append ?logged=true correctly even if backHref already has a query.
      const url = new URL(backHref, "http://x");
      url.searchParams.set("logged", "true");
      router.push(url.pathname + url.search);
      router.refresh();
    });
  };

  return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-emerald-500" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              Log Reading — {plant.name}
            </h2>
          </div>
          {plant.strain && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {plant.strain}
            </p>
          )}
        </div>

        {/* FC warning if not set */}
        {!hasFc && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold">Field Capacity not set</p>
              <p className="mt-0.5">
                Dryback can't be calculated without FC.{" "}
                <Link
                  href={`/plants/${plant.id}`}
                  className="underline font-bold"
                >
                  Open the plant page
                </Link>{" "}
                and click Current Weight to set it.
              </p>
            </div>
          </div>
        )}

        {/* FC reference */}
        {hasFc && (
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2">
            <span>
              <span className="font-bold uppercase tracking-wide text-[10px]">
                FC
              </span>{" "}
              <span className="font-mono">
                {fcDisplay!.toFixed(useGrams ? 1 : 2)} {unitLabel}
              </span>
            </span>
            {lastDisplay !== null && (
              <span>
                <span className="font-bold uppercase tracking-wide text-[10px]">
                  Last
                </span>{" "}
                <span className="font-mono">
                  {lastDisplay.toFixed(useGrams ? 1 : 2)} {unitLabel}
                </span>
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Scale className="size-4 text-emerald-500" />
              Current Weight ({unitLabel})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              disabled={!hasFc}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={
                useGrams ? "e.g. 152.4" : "e.g. 12.45"
              }
              className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-2xl font-bold font-mono focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
            />
            {/* Live dryback preview */}
            {preview.kind === "ok" && (
              <p className={`mt-1 text-xs font-bold ${preview.color}`}>
                {preview.pct.toFixed(1)}% dryback · {preview.label}
              </p>
            )}
            {preview.kind === "error" && (
              <p className="mt-1 text-xs font-bold text-red-500">
                {preview.error}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2.5 border border-zinc-200 dark:border-zinc-700">
              <input
                type="checkbox"
                checked={watered}
                onChange={(e) => setWatered(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Droplet className="size-4 text-blue-500" />
              Watered
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2.5 border border-zinc-200 dark:border-zinc-700">
              <input
                type="checkbox"
                checked={fed}
                onChange={(e) => setFed(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Droplet className="size-4 text-amber-500" />
              Fed
            </label>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Training Event
            </label>
            <select
              value={trainingEvent}
              onChange={(e) => setTrainingEvent(e.target.value as TrainingEvent)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {TRAINING_EVENTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              placeholder="Anything notable?"
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-500 text-center">{error}</p>
          )}
          {success && (
            <p className="text-xs font-bold text-emerald-500 text-center">
              Saved! Redirecting…
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || !hasFc}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="size-5" />
                Save Reading
              </>
            )}
          </button>
        </form>
      </div>
  );
}