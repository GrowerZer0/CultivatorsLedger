"use client";

import { useState } from "react";
import { ArrowRight, X, Loader2, Lightbulb, Scissors } from "lucide-react";
import { advancePlantStage, revertPlantStage } from "@/server/actions/stages";
import { useRouter } from "next/navigation";

interface AdvanceStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  currentStage: string;
  lightName?: string | null;
}

const STAGE_ORDER = ["seedling", "vegetative", "flowering", "harvest", "dry", "cure"];

export function AdvanceStageModal({ isOpen, onClose, plantId, currentStage, lightName }: AdvanceStageModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [updateLight, setUpdateLight] = useState(true);
  const [isReverting, setIsReverting] = useState(false);
const [revertStage, setRevertStage] = useState("");
  // Harvest State
  const [wetWeight, setWetWeight] = useState("");
  const [dryingMethod, setDryingMethod] = useState("hang_whole");

  if (!isOpen) return null;

  const currentIndex = STAGE_ORDER.indexOf(currentStage.toLowerCase());
  const nextStage = currentIndex !== -1 && currentIndex < STAGE_ORDER.length - 1 
    ? STAGE_ORDER[currentIndex + 1] 
    : null;

  if (!nextStage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-sm text-zinc-500 mb-4">This plant is already at the final stage ({currentStage}).</p>
          <button onClick={onClose} className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-bold">Close</button>
        </div>
      </div>
    );
  }

  const handleAdvance = async () => {
    if (nextStage === "harvest" && !wetWeight) {
      return alert("Please enter the wet weight before harvesting.");
    }

    setLoading(true);
    const harvestData = nextStage === "harvest" 
      ? { wetWeightLbs: parseFloat(wetWeight), dryingMethod }
      : undefined;

    const res = await advancePlantStage(plantId, nextStage, updateLight, harvestData);
    setLoading(false);

    if (res.success) {
      onClose();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const getLightRecommendation = () => {
    if (nextStage === "flowering") return "Switch to 12/12 hours, 100% intensity.";
    if (nextStage === "vegetative") return "Switch to 18/6 hours, 100% intensity.";
    if (nextStage === "harvest") return "Turn light OFF (0% intensity) for drying.";
    return "Keep current light settings.";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {nextStage === "harvest" ? "Harvest Plant" : "Advance Stage"}
          </h3>
          <button onClick={onClose} disabled={loading} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
        </div>
{currentIndex > 0 && (
  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
    <button 
      onClick={() => setIsReverting(!isReverting)}
      className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    >
      Made a mistake? Revert stage
    </button>
    
    {isReverting && (
      <div className="mt-3 flex gap-2">
        <select 
          value={revertStage} 
          onChange={(e) => setRevertStage(e.target.value)}
          className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
        >
          <option value="">Select stage to revert to...</option>
          {STAGE_ORDER.slice(0, currentIndex).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button 
          onClick={async () => {
            if (!revertStage) return;
            setLoading(true);
            const res = await revertPlantStage(plantId, revertStage);
            setLoading(false);
            if (res.success) { onClose(); router.refresh(); }
            else { alert(res.error); }
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg"
        >
          Revert
        </button>
      </div>
    )}
  </div>
)}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold capitalize">{currentStage}</div>
          <ArrowRight className="size-5 text-emerald-500" />
          <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold capitalize border border-emerald-500/30">
            {nextStage === "harvest" ? "Dry" : nextStage}
          </div>
        </div>

        {/* HARVEST SPECIFIC UI */}
        {nextStage === "harvest" && (
          <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold mb-1">
              <Scissors className="size-4 text-emerald-500" />
              Harvest Data
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase">Wet Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={wetWeight}
                onChange={(e) => setWetWeight(e.target.value)}
                placeholder="e.g. 4.5"
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase">Drying Method</label>
              <select
                value={dryingMethod}
                onChange={(e) => setDryingMethod(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
              >
                <option value="hang_whole">Hang Whole Plant</option>
                <option value="hang_branches">Hang Branches</option>
                <option value="rack">Drying Rack</option>
                <option value="paper_bag">Paper Bag</option>
              </select>
            </div>
          </div>
        )}

        {/* LIGHT UPDATE UI (Hide if Harvest, since we force light off) */}
        {lightName && nextStage !== "harvest" && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
            <div className="flex items-start gap-3">
              <Lightbulb className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Update Light Settings?</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 mb-2">
                  {lightName}: {getLightRecommendation()}
                </p>
                <label className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={updateLight} 
                    onChange={(e) => setUpdateLight(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Apply these settings to my light
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700">Cancel</button>
          <button 
            onClick={handleAdvance} 
            disabled={loading} 
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : nextStage === "harvest" ? "Harvest & Start Dry" : `Move to ${nextStage}`}
          </button>
        </div>
      </div>
    </div>
  );
}