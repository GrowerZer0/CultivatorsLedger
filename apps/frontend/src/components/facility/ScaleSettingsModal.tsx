"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Scale,
  RefreshCw,
  Loader2,
  X,
  AlertTriangle,
  Check,
  RotateCcw,
  Link2,
} from "lucide-react";
import {
  getLatestScaleReading,
  setFieldCapacity,
  tareScale,
} from "@/server/actions/plant-mgmt";
import { getAvailableLoadCells, assignSensorToPlant } from "@/server/actions/sensors";

interface ScaleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  plantName: string;
  useGrams: boolean;
  currentFieldCapacityLbs: number | null;
  assignedScaleId: string | null;
  assignedScaleName: string | null;
  onSaved?: () => void;
}

interface SensorOption {
  id: string;
  name: string;
  type: string;
}

export function ScaleSettingsModal({
  isOpen,
  onClose,
  plantId,
  plantName,
  useGrams,
  currentFieldCapacityLbs,
  assignedScaleId,
  assignedScaleName,
  onSaved,
}: ScaleSettingsModalProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [latestReadingLbs, setLatestReadingLbs] = useState<number | null>(null);
  const [latestReadingAt, setLatestReadingAt] = useState<string | null>(null);
  const [manualWeight, setManualWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Scale switching
  const [showSwitch, setShowSwitch] = useState(false);
  const [availableSensors, setAvailableSensors] = useState<SensorOption[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [pendingScaleId, setPendingScaleId] = useState<string>("");

  const unitLabel = useGrams ? "g" : "lbs";
  const toDisplay = (lbs: number | null) =>
    lbs === null ? null : useGrams ? lbs * 453.592 : lbs;
  const fromDisplay = (val: number) => (useGrams ? val / 453.592 : val);
  const formatWeight = (lbs: number | null) => {
    const d = toDisplay(lbs);
    if (d === null) return "—";
    return useGrams ? `${d.toFixed(1)} g` : `${d.toFixed(2)} lbs`;
  };

  // Load latest reading when the modal opens or when the assigned scale changes.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setManualWeight("");

    getLatestScaleReading(plantId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error);
          return;
        }
        if (res.latestLog) {
          setLatestReadingLbs(res.latestLog.currentWeightLbs);
          setLatestReadingAt(res.latestLog.timestamp);
        } else {
          setLatestReadingLbs(null);
          setLatestReadingAt(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load reading.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, plantId, assignedScaleId]);

  // Load available load cells when the user opens the switch dropdown.
  useEffect(() => {
    if (!showSwitch) return;
    let cancelled = false;
    setSensorsLoading(true);
    getAvailableLoadCells()
      .then((rows) => {
        if (!cancelled) setAvailableSensors(rows);
      })
      .catch(() => {
        if (!cancelled) setAvailableSensors([]);
      })
      .finally(() => {
        if (!cancelled) setSensorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showSwitch]);

  if (!isOpen) return null;

  const readingIsNegative = latestReadingLbs !== null && latestReadingLbs < 0;
  const fcIsNull = currentFieldCapacityLbs === null;
  const needsAttention = readingIsNegative || fcIsNull;

  const handleSetFcFromReading = () => {
    if (latestReadingLbs === null) {
      setError("No reading available. Log a reading first or enter manually.");
      return;
    }
    if (latestReadingLbs <= 0) {
      setError("Reading is 0 or negative. Tare the scale and put the pot back on.");
      return;
    }
    startTransition(async () => {
      const res = await setFieldCapacity({
        plantId,
        weightLbs: latestReadingLbs,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSuccessMsg(
        `Field capacity set to ${formatWeight(res.wetWeight)}. Dryback is now accurate.`,
      );
      onSaved?.();
    });
  };

  const handleSetFcManual = () => {
    const parsed = parseFloat(manualWeight);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive number.");
      return;
    }
    const weightLbs = fromDisplay(parsed);
    startTransition(async () => {
      const res = await setFieldCapacity({ plantId, weightLbs });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSuccessMsg(
        `Field capacity set to ${formatWeight(res.wetWeight)}. Dryback is now accurate.`,
      );
      setManualWeight("");
      onSaved?.();
    });
  };

  const handleReTare = () => {
    if (
      !confirm(
        "This clears the stored Field Capacity so you can re-establish it.\n\n" +
          "1. Remove the pot from the scale.\n" +
          "2. Tap Tare on the ESP32 web page (zeros the firmware).\n" +
          "3. Put the saturated pot back on the scale.\n" +
          "4. Come back and tap 'Set FC to current reading'.\n\nContinue?",
      )
    )
      return;
    startTransition(async () => {
      const res = await tareScale({ plantId });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSuccessMsg(res.message);
      // Refresh the latest reading
      const refreshed = await getLatestScaleReading(plantId);
      if (refreshed.success && refreshed.latestLog) {
        setLatestReadingLbs(refreshed.latestLog.currentWeightLbs);
        setLatestReadingAt(refreshed.latestLog.timestamp);
      }
      onSaved?.();
    });
  };

  const handleAssignScale = () => {
    if (!pendingScaleId) {
      setError("Select a scale first.");
      return;
    }
    startTransition(async () => {
      const res = await assignSensorToPlant({
        sensorId: pendingScaleId,
        plantId,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setShowSwitch(false);
      setPendingScaleId("");
      onSaved?.();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-emerald-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Scale Settings — {plantName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current scale */}
          <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Assigned Scale
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                {assignedScaleName ?? "None"}
              </div>
            </div>
            <button
              onClick={() => setShowSwitch(!showSwitch)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Link2 className="size-3" />
              {assignedScaleId ? "Switch" : "Assign"}
            </button>
          </div>

          {/* Switch scale UI */}
          {showSwitch && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg space-y-2">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                Switch to a different scale
              </div>
              {sensorsLoading ? (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Loading available scales…
                </div>
              ) : availableSensors.length === 0 ? (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  No unassigned scales available. Unassign the current one first or add a new sensor.
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={pendingScaleId}
                    onChange={(e) => setPendingScaleId(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/40 rounded text-xs"
                  >
                    <option value="">Select a scale…</option>
                    {availableSensors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignScale}
                    disabled={isPending || !pendingScaleId}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold"
                  >
                    Assign
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Current reading */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Current Reading
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div>
                <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                  {loading ? (
                    <Loader2 className="size-4 animate-spin inline" />
                  ) : (
                    formatWeight(latestReadingLbs)
                  )}
                </div>
                {latestReadingAt && (
                  <div className="text-[10px] text-zinc-500">
                    {new Date(latestReadingAt).toLocaleString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  getLatestScaleReading(plantId)
                    .then((r) => {
                      if (r.success && r.latestLog) {
                        setLatestReadingLbs(r.latestLog.currentWeightLbs);
                        setLatestReadingAt(r.latestLog.timestamp);
                      }
                    })
                    .finally(() => setLoading(false));
                }}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                title="Refresh reading"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Diagnostic banner */}
          {needsAttention && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                {readingIsNegative && (
                  <p className="font-bold">
                    Reading is negative — the scale isn't tared correctly.
                  </p>
                )}
                {fcIsNull && !readingIsNegative && (
                  <p className="font-bold">
                    Field Capacity not set — dryback can't be calculated.
                  </p>
                )}
                <p className="mt-1 text-[11px]">
                  Follow the steps below in order. Don't skip.
                </p>
              </div>
            </div>
          )}

          {/* Setup steps */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {readingIsNegative ? "Recalibrate" : "Set Field Capacity"}
            </div>
            <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1 list-decimal list-inside">
              <li>Remove the pot from the scale.</li>
              <li>
                Open the ESP32 web page and tap <strong>Tare</strong> (zeros the
                firmware).
              </li>
              <li>Put the empty container on the scale, tare again.</li>
              <li>
                Put the <strong>saturated pot</strong> back on the scale.
              </li>
              <li>Come back here and tap "Set FC to current reading" below.</li>
            </ol>
          </div>

          {/* Set FC from reading */}
          <div className="space-y-1">
            <button
              onClick={handleSetFcFromReading}
              disabled={
                isPending || latestReadingLbs === null || latestReadingLbs <= 0
              }
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Set FC to current reading
            </button>
            <p className="text-[10px] text-zinc-500 text-center">
              Use this right after a full watering, while the pot is saturated.
            </p>
          </div>

          {/* Manual FC entry */}
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={manualWeight}
                  onChange={(e) => setManualWeight(e.target.value)}
                  placeholder={`Enter FC in ${unitLabel}…`}
                  className="w-full px-3 py-2 pr-12 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">
                  {unitLabel}
                </span>
              </div>
              <button
                onClick={handleSetFcManual}
                disabled={isPending || !manualWeight}
                className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-bold transition-colors"
              >
                Set
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              Manual override — useful if the ESP32 hasn't polled yet.
            </p>
          </div>

          {/* Re-tare */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            <button
              onClick={handleReTare}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-bold transition-colors border border-amber-200 dark:border-amber-900/40"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Re-tare / Reset Field Capacity
            </button>
            <p className="text-[10px] text-zinc-500">
              Clears stored FC. You must also tap Tare on the ESP32 web page
              (with the pot off the scale).
            </p>
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="size-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Diagnostics */}
          {latestReadingLbs !== null && (
            <details className="text-[10px] text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                Diagnostics
              </summary>
              <div className="mt-1 font-mono space-y-0.5">
                <div>
                  raw lbs: {Number(latestReadingLbs).toFixed(4)} · grams:{" "}
                  {(Number(latestReadingLbs) * 453.592).toFixed(1)} g
                </div>
                <div>unit mode: {useGrams ? "grams (small scale)" : "lbs"}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}