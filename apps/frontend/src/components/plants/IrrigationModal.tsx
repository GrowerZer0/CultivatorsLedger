"use client";

import { useState, useTransition } from "react";
import { Droplet, FlaskConical, Scale, Loader2, X, Check } from "lucide-react";
import { recordIrrigation } from "@/server/actions/check-in";

interface IrrigationModalProps {
  plantId: string;
  plantName: string;
  currentWeight: number | null;
  useGrams: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function IrrigationModal({
  plantId,
  plantName,
  currentWeight,
  useGrams,
  isOpen,
  onClose,
}: IrrigationModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [preWeight, setPreWeight] = useState("");
  const [postWeight, setPostWeight] = useState("");
  const [watered, setWatered] = useState(true);
  const [fed, setFed] = useState(false);
  const [feedPh, setFeedPh] = useState("");
  const [feedEc, setFeedEc] = useState("");
  const [runoffEc, setRunoffEc] = useState("");
  const [notes, setNotes] = useState("");
  const [updateFc, setUpdateFc] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pre = preWeight ? parseFloat(preWeight) : null;
    const post = postWeight ? parseFloat(postWeight) : null;

    if (post === null) {
      setError("Post-water weight is required.");
      return;
    }

    // Convert to lbs if the user is entering grams
    const toLbs = (val: number | null) => (val === null ? null : useGrams ? val / 453.592 : val);

    startTransition(async () => {
      const res = await recordIrrigation({
        plantId,
        preWeightLbs: toLbs(pre),
        postWeightLbs: toLbs(post),
        watered,
        fed,
        feedPh: feedPh ? parseFloat(feedPh) : null,
        feedEc: feedEc ? parseFloat(feedEc) : null,
        runoffEc: runoffEc ? parseFloat(runoffEc) : null,
        updateFieldCapacity: updateFc,
        notes: notes.trim() || null,
      });

      if (res.success) {
        onClose();
        window.location.reload(); // Force a refresh to update the charts
      } else {
        setError(res.error || "Failed to log irrigation");
      }
    });
  };

  const inputUnit = useGrams ? "g" : "lbs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Droplet className="size-5 text-blue-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Log Irrigation — {plantName}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Pre/Post Weights */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">
                Pre-Water ({inputUnit})
              </label>
              <input
                type="number"
                step="0.1"
                value={preWeight}
                onChange={(e) => setPreWeight(e.target.value)}
                placeholder={currentWeight ? currentWeight.toFixed(1) : "e.g. 12.5"}
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">
                Post-Water ({inputUnit}) *
              </label>
              <input
                type="number"
                step="0.1"
                value={postWeight}
                onChange={(e) => setPostWeight(e.target.value)}
                placeholder="e.g. 15.2"
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-mono"
                required
              />
            </div>
          </div>

          {/* Watered / Fed toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={watered}
                onChange={(e) => setWatered(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <Droplet className="size-4 text-blue-500" />
              Watered
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={fed}
                onChange={(e) => setFed(e.target.checked)}
                className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
              />
              <FlaskConical className="size-4 text-amber-500" />
              Fed
            </label>
          </div>

          {/* Optional Feeding Data */}
          {fed && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/40">
              <div>
                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                  Feed pH
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={feedPh}
                  onChange={(e) => setFeedPh(e.target.value)}
                  placeholder="6.2"
                  className="w-full mt-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                  Feed EC
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={feedEc}
                  onChange={(e) => setFeedEc(e.target.value)}
                  placeholder="1.8"
                  className="w-full mt-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded text-sm"
                />
              </div>
            </div>
          )}

          {/* Runoff EC */}
          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">
              Runoff EC (optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={runoffEc}
              onChange={(e) => setRunoffEc(e.target.value)}
              placeholder="If you measured it"
              className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-mono"
            />
          </div>

          {/* Update FC toggle */}
          <div className="flex items-start gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <input
              type="checkbox"
              id="updateFc"
              checked={updateFc}
              onChange={(e) => setUpdateFc(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="updateFc" className="text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-bold text-zinc-900 dark:text-white">Update Field Capacity</span>
              <br />
              Check this if the post-water weight represents a fully saturated pot. Updates FC for future dryback calculations.
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Added Cal-Mag, pH adjusted to 6.3"
              className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-500 text-center">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Log Irrigation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}