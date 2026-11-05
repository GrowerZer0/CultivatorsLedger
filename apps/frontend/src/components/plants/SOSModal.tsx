"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, X, Check, Hospital } from "lucide-react";
import { logIssue } from "@/server/actions/issues";

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  plantName: string;
}

const SYMPTOMS = [
  { id: "yellow_leaves", label: "Yellow leaves" },
  { id: "brown_spots", label: "Brown spots" },
  { id: "drooping", label: "Drooping / wilting" },
  { id: "nutrient_burn", label: "Nutrient burn (leaf tips)" },
  { id: "pests", label: "Pests (visible)" },
  { id: "mold", label: "Mold / mildew" },
  { id: "slow_growth", label: "Slow growth" },
  { id: "other", label: "Other" },
];

export function SOSModal({ isOpen, onClose, plantId, plantName }: SOSModalProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selected.length === 0 && !notes.trim()) {
      setError("Select at least one symptom or add notes.");
      return;
    }

    startTransition(async () => {
      const res = await logIssue({
        plantId,
        symptoms: selected,
        notes: notes.trim() || null,
      });

      if (res.success) {
        onClose();
        window.location.reload();
      } else {
        setError(res.error || "Failed to log issue");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Hospital className="size-5 text-amber-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Log Issue — {plantName}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">
              Symptoms (select all that apply)
            </label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {SYMPTOMS.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    selected.includes(s.id)
                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-300"
                      : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything else you noticed?"
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
              className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Log Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}