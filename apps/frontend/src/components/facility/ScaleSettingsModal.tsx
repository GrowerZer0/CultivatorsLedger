"use client";

import { useEffect, useState } from "react";
import {
  Scale,
  RefreshCw,
  Check,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";
import {
  getLatestScaleReading,
  setFieldCapacity,
  tareScale,
} from "@/server/actions/plant-mgmt";

interface ScaleSettingsModalProps {
  open: boolean;
  onClose: () => void;
  plantId: string;
  plantName: string;
  /** Current Field Capacity from the DB (Plant.wetWeight), in lbs */
  currentFieldCapacityLbs: number | null;
  onSaved?: () => void;
}

export function ScaleSettingsModal({
  open,
  onClose,
  plantId,
  plantName,
  currentFieldCapacityLbs,
  onSaved,
}: ScaleSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taring, setTaring] = useState(false);

  const [latestReadingLbs, setLatestReadingLbs] = useState<number | null>(null);
  const [latestReadingAt, setLatestReadingAt] = useState<string | null>(null);
  const [latestSource, setLatestSource] = useState<string | null>(null);

  const [manualWeight, setManualWeight] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // "Which unit is this plant's scale using?"
  const isSmallScale =
    latestSource?.toLowerCase().includes("small") ||
    (latestReadingLbs !== null && latestReadingLbs < 5); // heuristic fallback
  const displayWeight = (lbs: number | null, withUnit = true) => {
    if (lbs === null || lbs === undefined) return "—";
    if (isSmallScale) {
      return withUnit ? `${(lbs * 453.592).toFixed(1)} g` : (lbs * 453.592).toFixed(1);
    }
    return withUnit ? `${Number(lbs).toFixed(2)} lbs` : Number(lbs).toFixed(2);
  };

  // Load the latest reading whenever the modal opens
  useEffect(() => {
    if (!open) return;
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
          setLatestReadingLbs(Number(res.latestLog.currentWeightLbs));
          setLatestReadingAt(res.latestLog.timestamp);
          setLatestSource(res.latestLog.sourceDevice ?? null);
        } else {
          setLatestReadingLbs(null);
          setLatestReadingAt(null);
          setLatestSource(null);
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
  }, [open, plantId]);

  if (!open) return null;

  const handleSetFCFromLatest = async () => {
    if (latestReadingLbs === null) {
      setError("No scale reading available. Log a reading first.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    const res = await setFieldCapacity({ plantId, weightLbs: latestReadingLbs });
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccessMsg(
      `Field capacity set to ${displayWeight(res.wetWeight)}. Dryback is now accurate.`
    );
    onSaved?.();
  };

  const handleSetFCManual = async () => {
    const parsed = Number(manualWeight);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive number.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    // If the user typed grams (small scale), convert to lbs for storage
    const weightLbs = isSmallScale ? parsed / 453.592 : parsed;
    const res = await setFieldCapacity({ plantId, weightLbs });
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccessMsg(
      `Field capacity set to ${displayWeight(res.wetWeight)}. Dryback is now accurate.`
    );
    setManualWeight("");
    onSaved?.();
  };

  const handleTare = async () => {
    if (
      !confirm(
        "This clears the stored Field Capacity so you can re-establish it.\n\n" +
          "1. Remove the pot from the scale.\n" +
          "2. Tap Tare on the ESP32 web page (this zeros the firmware).\n" +
          "3. Put the saturated pot back on the scale.\n" +
          "4. Come back and tap 'Set FC to current reading'.\n\nContinue?"
      )
    ) {
      return;
    }
    setTaring(true);
    setError(null);
    setSuccessMsg(null);
    const res = await tareScale({ plantId });
    setTaring(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccessMsg(res.message);
    // Re-pull the latest reading (should be ~0 now, but still useful to show)
    const refreshed = await getLatestScaleReading(plantId);
    if (refreshed.success && refreshed.latestLog) {
      setLatestReadingLbs(Number(refreshed.latestLog.currentWeightLbs));
      setLatestReadingAt(refreshed.latestLog.timestamp);
      setLatestSource(refreshed.latestLog.sourceDevice ?? null);
    }
    onSaved?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-emerald-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Scale Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Field Capacity (FC) is the weight of{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {plantName}
            </span>{" "}
            right after a full watering. Every dryback % in the app is computed
            against it — if FC is wrong, the dryback chart is wrong.
          </p>

          {/* Current state */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                Current Field Capacity
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {displayWeight(currentFieldCapacityLbs)}
              </div>
              {currentFieldCapacityLbs === null && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Not set — dryback is unreliable
                </div>
              )}
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                Latest Scale Reading
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-1 flex items-center gap-2">
                {loading ? (
                  <Loader2 className="size-4 animate-spin text-zinc-500" />
                ) : (
                  displayWeight(latestReadingLbs)
                )}
              </div>
              {latestReadingAt && (
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {new Date(latestReadingAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Set FC from latest */}
          <div className="space-y-1">
            <button
              onClick={handleSetFCFromLatest}
              disabled={saving || latestReadingLbs === null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
            >
              {saving ? (
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

          {/* Manual entry */}
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
                  placeholder={
                    isSmallScale ? "Enter FC in grams…" : "Enter FC in lbs…"
                  }
                  className="w-full px-3 py-2 pr-12 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">
                  {isSmallScale ? "g" : "lbs"}
                </span>
              </div>
              <button
                onClick={handleSetFCManual}
                disabled={saving || !manualWeight}
                className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-bold transition-colors"
              >
                Set
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              Manual override — useful if the ESP32 hasn&apos;t polled yet.
            </p>
          </div>

          {/* Tare */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            <button
              onClick={handleTare}
              disabled={taring}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-bold transition-colors border border-amber-200 dark:border-amber-900/40"
            >
              {taring ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Re-tare / Reset Field Capacity
            </button>
            <p className="text-[10px] text-zinc-500">
              Clears stored FC. You must also tap Tare on the ESP32 web page
              (with the pot off the scale) — the firmware zeros the ADC, the
              app just forgets the old FC.
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
                <div>source: {latestSource ?? "unknown"}</div>
                <div>
                  raw lbs: {Number(latestReadingLbs).toFixed(4)} · grams:{" "}
                  {(Number(latestReadingLbs) * 453.592).toFixed(1)} g
                </div>
                <div>unit mode: {isSmallScale ? "grams (small scale)" : "lbs"}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}