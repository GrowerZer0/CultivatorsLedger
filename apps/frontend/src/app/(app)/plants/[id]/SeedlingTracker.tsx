"use client";

import { useState } from "react";
import { Scale, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { saveSeedlingCheck } from "@/server/actions/seedling";

interface SeedlingTrackerProps {
  plantId: string;
  lastPlugWeight: number | null;
  light: any; // The light object from Prisma
}

const SYMPTOMS = [
  { id: "curl_down", label: "Clawing / Curling Down" },
  { id: "curl_up", label: "Tacoing / Curling Up" },
  { id: "droop", label: "Drooping" },
  { id: "yellow", label: "Yellowing Leaves" },
  { id: "stretch", label: "Stretching (Leggy Stem)" },
  { id: "none", label: "Looks Healthy" },
];

export function SeedlingTracker({ plantId, lastPlugWeight, light }: SeedlingTrackerProps) {
  const [weight, setWeight] = useState<string>("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Diagnosis Logic (Runs after saving)
  const generateDiagnosis = (weightG: number, symptoms: string[]) => {
    const isWet = weightG > 60; // Assuming ~75g is saturated
    const isDry = weightG < 40; // Assuming 35-40g is water time
    
    // Rule: Curling Down
    if (symptoms.includes("curl_down")) {
      if (isWet) return "⚠️ OVER-WATERED. The plug is too heavy. Do not water. Remove the dome for 2 hours to increase VPD and let it breathe.";
      if (light && light.dimmerPercent > 60) return "💡 LIGHT STRESS. The leaves are clawing to protect themselves. Lower light intensity to 50% or less.";
      return "🤔 UNKNOWN STRESS. Leaves are curling but weight is normal. Check light distance (should be 24\"). Wait 24 hours.";
    }

    // Rule: Drooping
    if (symptoms.includes("droop")) {
      if (isDry) return "💧 UNDER-WATERED. Plug is light. Water from the bottom until saturated.";
      if (isWet) return "⚠️ OVER-WATERED. Plug is heavy. Do not water. Ensure tray isn't sitting in a puddle.";
    }

    // Rule: Stretching
    if (symptoms.includes("stretch")) {
      if (light && light.dimmerPercent < 50) return "💡 LIGHT TOO WEAK. Increase intensity to 60% and lower the light closer to the dome.";
      return "💡 LIGHT GAP. Light is at good intensity, but distance is too far. Lower the light 2-3 inches.";
    }

    // Rule: Tacoing
    if (symptoms.includes("curl_up") && isWet) {
      return "🌡️ HEAT/RH STRESS. Leaves are tacoing. Check tent temp (target 75-80°F) and raise RH if below 60%.";
    }

    if (isDry) return "💧 TIME TO WATER. Plug weight is low. Water from the bottom until fully saturated.";
    if (symptoms.includes("none")) return "✅ ALL GOOD. Environment and weight are in optimal ranges. Keep doing what you're doing.";

    return "🔍 MONITOR. No immediate action required, but keep an eye on new growth.";
  };

  const handleSave = async () => {
    const weightNum = parseInt(weight);
    if (isNaN(weightNum)) return alert("Please enter a valid weight in grams.");
    if (selectedSymptoms.length === 0) return alert("Please select at least one symptom.");

    setIsSaving(true);
    const res = await saveSeedlingCheck({
      plantId,
      plugWeightG: weightNum,
      symptoms: selectedSymptoms,
    });

    if (res.success) {
      const diagnosis = generateDiagnosis(weightNum, selectedSymptoms);
      setResult(diagnosis);
    } else {
      alert(res.error);
    }
    setIsSaving(false);
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-emerald-500 flex items-center gap-2">
          🌱 Seedling Tracker
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Log objective data to diagnose issues before they become fatal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Weight Input */}
        <div>
          <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase flex items-center gap-1.5 mb-1">
            <Scale className="size-3.5" /> Plug Weight (Grams)
          </label>
          <input
            type="number"
            placeholder={lastPlugWeight ? `Last: ${lastPlugWeight}g` : "e.g. 54"}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold text-lg"
          />
          <p className="text-[10px] text-zinc-500 mt-1">Target: 40g (water) to 65g (saturated).</p>
        </div>

        {/* Light Context (Read-Only) */}
        <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5 mb-1">
            💡 Light Context
          </label>
          {light ? (
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              {light.dimmerPercent}% Intensity · {light.distanceInches || "?"}" away
            </p>
          ) : (
            <p className="text-sm text-zinc-500">No light assigned</p>
          )}
        </div>
      </div>

      {/* Symptoms */}
      <div>
        <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase mb-2 block">
          What does the plant look like?
        </label>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map(sym => (
            <button
              key={sym.id}
              onClick={() => toggleSymptom(sym.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                selectedSymptoms.includes(sym.id)
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500"
              }`}
            >
              {sym.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="size-5 animate-spin" /> : "Run Diagnosis"}
      </button>

      {/* Result Panel */}
      {result && (
        <div className="p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-2">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-amber-400" /> Recommended Action:
          </h3>
          <p className="text-sm leading-relaxed">{result}</p>
        </div>
      )}
    </div>
  );
}