"use client";

import { useState } from "react";
import { Scale, Droplet, CheckCircle2, Loader2 } from "lucide-react";
import { saveSeedlingCheck } from "@/server/actions/seedling";

interface DryCureTrackerProps {
  plantId: string;
  stage: string; // "dry" or "cure"
  lastWeight: number | null;
}

export function DryCureTracker({ plantId, stage, lastWeight }: DryCureTrackerProps) {
  const [weight, setWeight] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [burped, setBurped] = useState(false);

  const isDry = stage === "dry";

  const handleSave = async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) return alert("Please enter a valid weight.");

    setIsSaving(true);
    await saveSeedlingCheck({
      plantId,
      plugWeightG: weightNum,
      symptoms: [isDry ? "dry_check" : "cure_check"],
    });
    setIsSaving(false);
    setWeight("");
    window.location.reload();
  };

  const handleBurp = () => {
    // In a real app, this would log an event to the timeline.
    // For now, we just toggle the UI state.
    setBurped(true);
    alert("Logged! Remember to burp again tomorrow.");
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className={`text-lg font-bold flex items-center gap-2 ${isDry ? "text-amber-500" : "text-emerald-500"}`}>
          {isDry ? "🍂 Drying Tracker" : "🫙 Curing Tracker"}
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          {isDry 
            ? "Target: 60°F / 60% RH. Check weight daily. Ready to cure when weight loss stalls." 
            : "Target: 58-62% RH. Burp jars twice daily week 1, then daily."}
        </p>
      </div>

      {isDry ? (
        // DRY UI
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
      ) : (
        // CURE UI
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Today's Action</p>
            {burped ? (
              <p className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="size-4" /> Burped for today
              </p>
            ) : (
              <button
                onClick={handleBurp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Log Burp (Open Jars)
              </button>
            )}
            <p className="text-[10px] text-zinc-400 mt-2">Burp twice daily in Week 1.</p>
          </div>
          
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center">
            <p className="text-xs font-bold text-zinc-500 uppercase">Jar RH Target</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-1 flex items-center gap-1">
              <Droplet className="size-4 text-blue-500" /> 58% - 62% RH
            </p>
            <p className="text-[10px] text-zinc-400 mt-2">If RH is too high, leave jars open for 1 hour. If too low, add a Boveda pack.</p>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving || (!isDry && !weight)} // Disable weight logging during cure if we're not tracking jars yet
        className={`w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
          isDry ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {isSaving ? <Loader2 className="size-5 animate-spin" /> : "Log Weight"}
      </button>
    </div>
  );
}