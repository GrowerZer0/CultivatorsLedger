"use client";

import { useState, useMemo, useCallback } from "react";
import {
  FlaskConical,
  X,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import {
  commercialFeedSchedules,
  type FeedSchedule,
  type NutrientDose,
} from "@/lib/cultivation-engine";

interface NutrientCalculatorProps {
  plantStage?: string;
  plantStrain?: string;
  plantName?: string;
  weekOfStage?: number | null;
  onClose?: () => void;
  inline?: boolean;
}

export function NutrientCalculator({
  plantStage,
  plantStrain,
  plantName,
  weekOfStage,
  onClose,
  inline = false,
}: NutrientCalculatorProps) {
  // Pick the matching schedule based on stage, fallback to first
  const defaultSchedule = useMemo(() => {
    if (plantStage) {
      const match = commercialFeedSchedules.find(
        (s) => s.stage?.toLowerCase() === plantStage.toLowerCase()
      );
      if (match) return match;
    }
    return commercialFeedSchedules[0];
  }, [plantStage]);

  const [activeLineId, setActiveLineId] = useState<string>(defaultSchedule.id);
  const [gallons, setGallons] = useState<number>(3);
  const [copied, setCopied] = useState(false);

  const activeSchedule = useMemo<FeedSchedule>(
    () =>
      commercialFeedSchedules.find((s) => s.id === activeLineId) ||
      defaultSchedule,
    [activeLineId, defaultSchedule]
  );

  const steps = useMemo(() => {
    const result: Array<{
      order: number;
      text: string;
      detail?: string;
    }> = [];

    result.push({
      order: 1,
      text: `Fill ${gallons.toFixed(1)} gallons of water`,
    });

    activeSchedule.doses.forEach((dose: NutrientDose, i: number) => {
      const totalMl = dose.mlPerGallon * gallons;
      result.push({
        order: i + 2,
        text: `Add ${dose.product}`,
        detail: `${totalMl.toFixed(1)} mL  (${dose.mlPerGallon} mL/gal)`,
      });
    });

    result.push({
      order: activeSchedule.doses.length + 2,
      text: `Check pH`,
      detail: `Target ${activeSchedule.targetPh?.toFixed(1) ?? "5.8"}`,
    });

    result.push({
      order: activeSchedule.doses.length + 3,
      text: `Check EC`,
      detail: `Target ${activeSchedule.targetEc.toFixed(1)}`,
    });

    return result;
  }, [activeSchedule, gallons]);

  const handleCopy = useCallback(async () => {
    const text = [
      `${activeSchedule.label}`,
      `Mix ${gallons.toFixed(1)} gallons`,
      "",
      ...steps.map((s) => `${s.order}. ${s.text}${s.detail ? " — " + s.detail : ""}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — no-op
    }
  }, [activeSchedule, gallons, steps]);

  const isLastWeek = weekOfStage !== null && weekOfStage !== undefined && weekOfStage >= 8;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl ${
        !inline ? "max-h-[90vh] overflow-y-auto" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FlaskConical className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Nutrient Mix
            </h3>
            {(plantName || plantStrain) && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {plantName || plantStrain}
              </p>
            )}
            {plantStage && (
              <p className="text-[10px] text-zinc-400 mt-0.5 capitalize">
                {plantStage}
                {weekOfStage ? ` · Week ${weekOfStage}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
          {!inline && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Feed line selector */}
      <div className="mb-4">
        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 tracking-wide mb-1">
          Feed Line
        </label>
        <select
          value={activeLineId}
          onChange={(e) => setActiveLineId(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
        >
          {commercialFeedSchedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Gallons input with +/- */}
      <div className="mb-5">
        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 tracking-wide mb-1">
          Gallons to Mix
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGallons((g) => Math.max(0.5, g - 0.5))}
            className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={gallons}
            onChange={(e) => setGallons(Number(e.target.value) || 0.5)}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-center text-lg font-bold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
          />
          <button
            onClick={() => setGallons((g) => g + 0.5)}
            className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>

      {/* Ordered instruction list */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30 p-4 mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
          Mix Order
        </div>
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.order} className="flex gap-3">
              <div className="shrink-0 size-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                {step.order}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {step.text}
                </p>
                {step.detail && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Notes */}
      <div className="space-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <p>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Add Cal-Mag before the two-part minerals
          </span>{" "}
          — it reacts with phosphates and sulfates if added later.
        </p>
        <p>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Add one mineral, wait 5 minutes, add the next.
          </span>{" "}
          Don't dump everything in at once.
        </p>
        {activeSchedule.brand === "Athena Blended" && (
          <p>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Athena Blended includes Ca/Mg.
            </span>{" "}
            Only add the optional Cal-Mag if using RO water or unbuffered coco.
          </p>
        )}
        {isLastWeek && (
          <p className="text-amber-600 dark:text-amber-400">
            <span className="font-semibold">Week 8+.</span> Consider lowering EC
            and starting a flush. See the harvest checklist.
          </p>
        )}
      </div>

      {/* Footer */}
      {!inline && (
        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}