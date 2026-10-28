"use client";

import { useState } from "react";
import { Scale, Droplet, Sun, Loader2, CheckCircle2 } from "lucide-react";
import { saveSeedlingCheck } from "@/server/actions/seedling";

interface DryCureTrackerProps {
  plantId: string;
  stage: string; // "dry" or "cure"
  lastWeight: number | null;
}

export function DryCureTracker({ plantId, stage, lastWeight }: DryCureTrackerProps) {
  const [weight, setWeight] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isDry = stage === "dry";

  const handleSave = async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) return alert("Please enter a valid weight.");

    setIsSaving(true);
    await saveSeedlingCheck({
      plantId,
      plugWeightG: weightNum, // We reuse the seedling check table for weight tracking
      symptoms: [isDry ? "dry_check" : "cure_check"],
    });
    setIsSaving(false);
    setWeight("");
    window.location.reload(); // Quick refresh to get the new weight
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2 capitalize">
          {isDry ? "🍂 Drying Tracker" : "🫙 Curing Tracker"}
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          {isDry 
            ? "Target: 60°F / 60% RH. Check weight daily. Ready to cure when weight loss stalls." 
            : "Target: 58-62% RH. Burp jars twice daily week 1, then daily."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1.5 mb-1">
            <Scale className="size-3.5" /> Current Weight (Grams)
          </label>
          <input
            type="number"
            placeholder={lastWeight ? `Last: ${lastWeight}g` : "e.g. 150"}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold text-lg"
          />
        </div>
        
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center">
          <p className="text-xs font-bold text-zinc-500 uppercase">Environment Status</p>
          <p className="text-sm font-semibold text-emerald-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="size-4" /> VPD & RH in range
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="size-5 animate-spin" /> : "Log Weight"}
      </button>
    </div>
  );
}