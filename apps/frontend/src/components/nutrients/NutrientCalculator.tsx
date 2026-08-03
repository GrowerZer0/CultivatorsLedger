//apps/frontend/src/components/nutrients/NutrientCalculator.tsx

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Droplets,
  Sprout,
  X,
  FlaskConical,
  Gauge,
  Beaker,
  Scale,
  Leaf,
} from "lucide-react";
import {
  calculateReservoirDelta,
  commercialFeedSchedules,
  type FeedSchedule,
  type NutrientDose,
} from "@/lib/cultivation";
import { getCustomBlueprints } from "@/app/actions";

// --------------------------------------------
// Number Field Component
// --------------------------------------------
type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  placeholder?: string;
};

function NumberField({
  label,
  value,
  onChange,
  step = 0.05,
  min = 0,
  max = 999,
  disabled = false,
  placeholder,
}: NumberFieldProps) {
  return (
    <label className="grid gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 tracking-wide">
      {label}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-40 transition-all"
      />
    </label>
  );
}

// --------------------------------------------
// Main Nutrient Calculator Component
// --------------------------------------------
type Mode = "batch" | "reservoir";

interface NutrientCalculatorProps {
  mode?: Mode; // default: 'batch'
  plantStage?: string; // for auto-selecting feed schedule
  plantStrain?: string; // for display only
  plantWeight?: number; // for display only
  onClose?: () => void; // for modal mode
  inline?: boolean; // if true, render as full page (no close button)
}

export function NutrientCalculator({
  mode: initialMode = "batch",
  plantStage,
  plantStrain,
  plantWeight,
  onClose,
  inline = false,
}: NutrientCalculatorProps) {
  // --- State ---
  const [mode, setMode] = useState<Mode>(initialMode);
  const [customBlueprints, setCustomBlueprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Feed schedule selection
  const [activeLineId, setActiveLineId] = useState<string>("");

  // Batch mode fields
  const [gallonsToMix, setGallonsToMix] = useState<number>(5);

  // Reservoir mode fields
  const [reservoirGallons, setReservoirGallons] = useState<number>(40);
  const [leftoverGallons, setLeftoverGallons] = useState<number>(11.5);
  const [currentEc, setCurrentEc] = useState<number>(1.4);

  // pH and EC targets (editable)
  const [phTarget, setPhTarget] = useState<number>(6.0);
  const [ecTarget, setEcTarget] = useState<number>(1.5);

  // Measured values (optional)
  const [measuredPh, setMeasuredPh] = useState<number | "">("");
  const [measuredEc, setMeasuredEc] = useState<number | "">("");

  // --- Load custom blueprints ---
  const loadBlueprints = useCallback(async () => {
    setLoading(true);
    try {
      const blueprints = await getCustomBlueprints();
      setCustomBlueprints(blueprints || []);
    } catch (err) {
      console.error("Failed to load nutrient blueprints:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlueprints();
  }, [loadBlueprints]);

  // --- Combined schedules (commercial + custom) ---
  const combinedSchedules = useMemo<FeedSchedule[]>(() => {
    const baseMerged = commercialFeedSchedules.map((s) => {
      const match = customBlueprints.find((cb) => cb.id === s.id);
      return match
        ? {
            ...s,
            id: match.id,
            brand: match.brand,
            stage: match.stage,
            targetEc: match.target_ec,
            doses: match.doses_json as NutrientDose[],
          }
        : s;
    });
    const completelyNewCustom = customBlueprints
      .filter((cb) => !commercialFeedSchedules.find((s) => s.id === cb.id))
      .map((cb) => ({
        id: cb.id,
        brand: cb.brand,
        label: cb.brand,
        stage: cb.stage,
        targetEc: cb.target_ec,
        targetPh: 5.8,
        doses: cb.doses_json as NutrientDose[],
      }));
    return [...baseMerged, ...completelyNewCustom];
  }, [customBlueprints]);

  // --- Auto-select feed schedule based on plantStage ---
  useEffect(() => {
    if (plantStage && combinedSchedules.length > 0 && !activeLineId) {
      // Try to find a schedule matching the stage
      const matching = combinedSchedules.find(
        (s) => s.stage && s.stage.toLowerCase() === plantStage.toLowerCase()
      );
      if (matching) {
        setActiveLineId(matching.id);
        setEcTarget(matching.targetEc);
        setPhTarget(matching.targetPh ?? 5.8);
        return;
      }
    }
    // Fallback: select first schedule
    if (combinedSchedules.length > 0 && !activeLineId) {
      setActiveLineId(combinedSchedules[0].id);
      setEcTarget(combinedSchedules[0].targetEc);
      setPhTarget(combinedSchedules[0].targetPh ?? 5.8);
    }
  }, [plantStage, combinedSchedules, activeLineId]);

  // --- Active schedule ---
  const activeSchedule = useMemo<FeedSchedule>(() => {
    return (
      combinedSchedules.find((s) => s.id === activeLineId) ||
      combinedSchedules[0] ||
      commercialFeedSchedules[0]
    );
  }, [activeLineId, combinedSchedules]);

  // Update targets when schedule changes
  useEffect(() => {
    if (activeSchedule) {
      setEcTarget(activeSchedule.targetEc);
      setPhTarget(activeSchedule.targetPh ?? 5.8);
    }
  }, [activeSchedule]);

  // --- Calculations ---
  const reservoirDelta = useMemo(() => {
    if (mode === "reservoir") {
      return calculateReservoirDelta({
        reservoirGallons,
        leftoverGallons,
        doses: activeSchedule.doses,
        currentEc: currentEc,
        targetEc: ecTarget,
      });
    }
    return null;
  }, [mode, reservoirGallons, leftoverGallons, activeSchedule.doses, currentEc, ecTarget]);

  // Batch mode: simple multiplication
  const batchNutrients = useMemo(() => {
    if (mode === "batch") {
      return activeSchedule.doses.map((dose) => ({
        ...dose,
        totalMl: dose.mlPerGallon * gallonsToMix,
      }));
    }
    return [];
  }, [mode, activeSchedule.doses, gallonsToMix]);

  // --- Reset to defaults ---
  const handleReset = () => {
    if (mode === "batch") {
      setGallonsToMix(5);
    } else {
      setReservoirGallons(40);
      setLeftoverGallons(11.5);
      setCurrentEc(1.4);
    }
    setMeasuredPh("");
    setMeasuredEc("");
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500 animate-pulse">
        Loading nutrient recipes...
      </div>
    );
  }

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
              {mode === "batch" ? "Batch Mix Calculator" : "Reservoir Top-Off Calculator"}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {mode === "batch"
                ? "Mix exact amounts for a single feeding"
                : "Top off reservoir while maintaining EC balance"}
            </p>
            {plantStrain && (
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {plantStrain} {plantWeight ? `• ${plantWeight} lbs` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!inline && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X className="size-4 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 w-fit">
        <button
          onClick={() => setMode("batch")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
            mode === "batch"
              ? "bg-white dark:bg-zinc-950 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Batch Mix
        </button>
        <button
          onClick={() => setMode("reservoir")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
            mode === "reservoir"
              ? "bg-white dark:bg-zinc-950 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Reservoir
        </button>
      </div>

      {/* Feed Schedule Selector */}
      <div className="mb-4">
        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 tracking-wide mb-1">
          Feed Schedule
        </label>
        <select
          value={activeLineId}
          onChange={(e) => setActiveLineId(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
        >
          {combinedSchedules.map((s) => (
            <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900">
              {s.brand} {s.stage ? `(${s.stage})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Input Fields */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        {mode === "batch" ? (
          <NumberField
            label="Gallons to Mix"
            value={gallonsToMix}
            onChange={setGallonsToMix}
            step={0.5}
            min={0.5}
          />
        ) : (
          <>
            <NumberField
              label="Tank Capacity (Gal)"
              value={reservoirGallons}
              onChange={setReservoirGallons}
              step={1}
              min={0}
            />
            <NumberField
              label="Leftover Volume (Gal)"
              value={leftoverGallons}
              onChange={setLeftoverGallons}
              step={0.5}
              min={0}
            />
            <NumberField
              label="Current EC (optional)"
              value={currentEc}
              onChange={setCurrentEc}
              step={0.05}
              min={0}
              placeholder="e.g., 1.4"
            />
          </>
        )}
      </div>

      {/* pH & EC Targets + Measured Values */}
      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <NumberField
          label="pH Target"
          value={phTarget}
          onChange={setPhTarget}
          step={0.1}
          min={0}
          max={14}
        />
        <NumberField
          label="EC Target"
          value={ecTarget}
          onChange={setEcTarget}
          step={0.05}
          min={0}
          max={5}
        />
        <NumberField
          label="Measured pH (optional)"
          value={typeof measuredPh === "number" ? measuredPh : 0}
          onChange={(v) => setMeasuredPh(v || "")}
          step={0.1}
          min={0}
          max={14}
          placeholder="--"
        />
        <NumberField
          label="Measured EC (optional)"
          value={typeof measuredEc === "number" ? measuredEc : 0}
          onChange={(v) => setMeasuredEc(v || "")}
          step={0.05}
          min={0}
          max={5}
          placeholder="--"
        />
      </div>

      {/* Nutrient Breakdown */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 px-1">
          <Sprout className="size-3.5" />
          <span>Nutrient Doses</span>
        </div>
        {mode === "batch" ? (
          batchNutrients.map((dose, index) => (
            <div
              key={`${dose.product}-${index}`}
              className={`grid gap-3 grid-cols-[1fr_80px_90px] items-center rounded-lg px-3 py-2 text-xs ${
                index % 2 === 0
                  ? "bg-zinc-50/50 dark:bg-zinc-800/30"
                  : "bg-transparent"
              }`}
            >
              <div className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {dose.product}
              </div>
              <div className="text-center font-mono text-zinc-500 dark:text-zinc-400">
                {dose.mlPerGallon} mL/g
              </div>
              <div className="text-center font-black font-mono text-emerald-400">
                {dose.totalMl.toFixed(1)} mL
              </div>
            </div>
          ))
        ) : (
          reservoirDelta?.nutrientsToAdd.map((dose, index) => (
            <div
              key={`${dose.product}-${index}`}
              className={`grid gap-3 grid-cols-[1fr_80px_90px] items-center rounded-lg px-3 py-2 text-xs ${
                index % 2 === 0
                  ? "bg-zinc-50/50 dark:bg-zinc-800/30"
                  : "bg-transparent"
              }`}
            >
              <div className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {dose.product}
              </div>
              <div className="text-center font-mono text-zinc-500 dark:text-zinc-400">
                {dose.mlPerGallon} mL/g
              </div>
              <div
                className={`text-center font-black font-mono transition-all ${
                  reservoirDelta?.isCriticalClamp
                    ? "text-red-400"
                    : "text-orange-400"
                }`}
              >
                {dose.totalMl.toFixed(1)} mL
              </div>
            </div>
          ))
        )}
      </div>

      {/* Output Summary */}
      <div
        className={`rounded-xl border p-4 transition-all ${
          mode === "reservoir" && reservoirDelta?.isCriticalClamp
            ? "bg-red-950/20 border-red-900/60"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/30"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            mode === "reservoir" && reservoirDelta?.isCriticalClamp
              ? "text-red-400"
              : "text-emerald-400"
          }`}
        >
          <Gauge className="size-4" />
          <span>
            {mode === "batch"
              ? "Batch Mix Summary"
              : "Reservoir Top-Off Summary"}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-medium">
          {mode === "batch" ? (
            <>
              Mix <span className="font-black">{gallonsToMix}</span> gallons.
              Add <span className="font-black text-emerald-400">
                {batchNutrients.reduce(
                  (sum, d) => sum + d.totalMl,
                  0
                ).toFixed(1)}
              </span>{" "}
              mL total nutrients. Target EC:{" "}
              <span className="font-black">{ecTarget}</span>.
              {measuredEc ? ` Measured EC: ${measuredEc}.` : ""}
            </>
          ) : (
            <>
              Top off with <span className="font-black">{reservoirDelta?.topOffGallons}</span> gallons
              of water. Blend to{" "}
              <span
                className={`font-black ${
                  reservoirDelta?.isCriticalClamp ? "text-red-400" : "text-orange-400"
                }`}
              >
                {reservoirDelta?.adjustedTopOffEc} EC
              </span>
              . {reservoirDelta?.alerts?.length ? `⚠️ ${reservoirDelta.alerts[0]}` : ""}
            </>
          )}
        </p>
        {mode === "reservoir" && reservoirDelta?.isCriticalClamp && (
          <p className="mt-1 text-[10px] text-red-400">
            ⚠️ Osmotic shock clamp applied. EC capped at 3.5 to prevent burn.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          Reset to Defaults
        </button>
        {!inline && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}