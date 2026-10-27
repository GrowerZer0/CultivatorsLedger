"use client";

import { useState } from "react";
import { ArrowRight, X, Loader2, Lightbulb } from "lucide-react";
import { advancePlantStage } from "@/server/actions/stages";
import { useRouter } from "next/navigation";

interface AdvanceStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  currentStage: string;
  lightName?: string | null;
}

const STAGE_ORDER = ["seedling", "veg", "flower", "harvest", "dry", "cure"];

export function AdvanceStageModal({ isOpen, onClose, plantId, currentStage, lightName }: AdvanceStageModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [updateLight, setUpdateLight] = useState(true);

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
    setLoading(true);
    const res = await advancePlantStage(plantId, nextStage, updateLight);
    setLoading(false);

    if (res.success) {
      onClose();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const getLightRecommendation = () => {
    if (nextStage === "flower") return "Switch to 12/12 hours, 100% intensity.";
    if (nextStage === "veg") return "Switch to 18/6 hours, 100% intensity.";
    return "Keep current light settings.";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Advance Stage</h3>
          <button onClick={onClose} disabled={loading} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
        </div>

        <div className="flex items-center justify-center gap-4 py-6">
          <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold capitalize">{currentStage}</div>
          <ArrowRight className="size-5 text-emerald-500" />
          <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold capitalize border border-emerald-500/30">
            {nextStage}
          </div>
        </div>

        {lightName && (
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
            {loading ? <Loader2 className="size-4 animate-spin" /> : `Move to ${nextStage}`}
          </button>
        </div>
      </div>
    </div>
  );
}