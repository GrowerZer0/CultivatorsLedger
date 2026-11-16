"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X, Loader2, Lightbulb, Scissors } from "lucide-react";
import { advancePlantStage, revertPlantStage } from "@/server/actions/stages";
import { useRouter } from "next/navigation";
import { archivePlant } from "@/server/actions/plant-mgmt";

interface LightInfo {
  name: string;
  scheduleHoursOn: number;
  dimmerPercent: number;
  distanceInches: number | null;
}

interface AdvanceStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  currentStage: string;
  light?: LightInfo | null;
}

const STAGE_ORDER = ["seedling", "vegetative", "flowering", "dry", "cure", "archived"];

function recommendLight(nextStage: string): { hours: number; dimmer: number } {
  if (nextStage === "flowering") return { hours: 12, dimmer: 100 };
  if (nextStage === "vegetative") return { hours: 18, dimmer: 100 };
  if (nextStage === "seedling") return { hours: 18, dimmer: 50 };
  if (nextStage === "dry" || nextStage === "cure") return { hours: 0, dimmer: 0 };
  return { hours: 18, dimmer: 100 };
}

export function AdvanceStageModal({
  isOpen,
  onClose,
  plantId,
  currentStage,
  light,
}: AdvanceStageModalProps) {
  const router = useRouter();

  // ═══ ALL useState HOOKS AT THE TOP — no conditional returns before this ═══
  const [loading, setLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [revertStage, setRevertStage] = useState("");
  const [wetWeight, setWetWeight] = useState("");
  const [dryingMethod, setDryingMethod] = useState("hang_whole");

  const [updateLight, setUpdateLight] = useState(true);
  const [lightHoursOn, setLightHoursOn] = useState<number>(18);
  const [lightDimmer, setLightDimmer] = useState<number>(100);
  const [lightDistance, setLightDistance] = useState<number | "">("");

  // Compute nextStage from currentStage (pure, no hooks)
  const currentIndex = STAGE_ORDER.indexOf(currentStage.toLowerCase());
  const nextStage =
    currentIndex !== -1 && currentIndex < STAGE_ORDER.length - 1
      ? STAGE_ORDER[currentIndex + 1]
      : null;

  // Sync light form values when the modal opens or the target stage changes.
  useEffect(() => {
    if (!nextStage) return;
    const rec = recommendLight(nextStage);
    setLightHoursOn(light?.scheduleHoursOn ?? rec.hours);
    setLightDimmer(light?.dimmerPercent ?? rec.dimmer);
    setLightDistance(light?.distanceInches ?? "");
  }, [nextStage, light]);

  // ═══ CONDITIONAL RETURNS AFTER ALL HOOKS ═══
  if (!isOpen) return null;

  if (!nextStage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-sm text-zinc-500 mb-4">
            This plant is already at the final stage ({currentStage}).
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isHarvestTransition = nextStage === "dry";
  const showLightForm =
    !!light && nextStage !== "dry" && nextStage !== "archived";

  const handleAdvance = async () => {
    if (nextStage === "dry" && !wetWeight) {
      return alert("Please enter the wet weight before starting the dry phase.");
    }

    setLoading(true);

    if (nextStage === "archived") {
      const res = await archivePlant(plantId);
      setLoading(false);
      if (res.success) {
        onClose();
        router.refresh();
        router.push("/plants/archive");
      } else {
        alert(res.error);
      }
      return;
    }

    const harvestData =
      nextStage === "dry"
        ? { wetWeightLbs: parseFloat(wetWeight), dryingMethod }
        : undefined;

    const lightOverride =
      showLightForm && updateLight
        ? {
            scheduleHoursOn: lightHoursOn,
            dimmerPercent: lightDimmer,
            distanceInches: lightDistance === "" ? null : lightDistance,
          }
        : undefined;

    const res = await advancePlantStage(
      plantId,
      nextStage,
      showLightForm && updateLight,
      harvestData,
      lightOverride,
    );
    setLoading(false);

    if (res.success) {
      onClose();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {isHarvestTransition ? "Harvest Plant" : "Advance Stage"}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="size-5" />
          </button>
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
                  {STAGE_ORDER.slice(0, currentIndex).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    if (!revertStage) return;
                    setLoading(true);
                    const res = await revertPlantStage(plantId, revertStage);
                    setLoading(false);
                    if (res.success) {
                      onClose();
                      router.refresh();
                    } else {
                      alert(res.error);
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg"
                >
                  Revert
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 py-4">
          <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold capitalize">
            {currentStage}
          </div>
          <ArrowRight className="size-5 text-emerald-500" />
          <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold capitalize border border-emerald-500/30">
            {nextStage}
          </div>
        </div>

        {isHarvestTransition && (
          <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold mb-1">
              <Scissors className="size-4 text-emerald-500" />
              Harvest Data
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase">
                Wet Weight (lbs)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={wetWeight}
                onChange={(e) => setWetWeight(e.target.value)}
                placeholder="e.g. 4.5"
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase">
                Drying Method
              </label>
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

        {nextStage === "archived" && (
          <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2 text-center">
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              Finish this grow?
            </p>
            <p className="text-xs text-zinc-500">
              This will hide the plant from your dashboard and plants list. You
              can still view it and export its data from the Archived Grows page.
            </p>
          </div>
        )}

        {showLightForm && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
            <div className="flex items-start gap-3">
              <Lightbulb className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                    Update Light Settings?
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {light!.name} — adjust before confirming the stage change.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateLight}
                    onChange={(e) => setUpdateLight(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Apply these settings to my light
                </label>

                {updateLight && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase">
                        Hours On
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={lightHoursOn}
                        onChange={(e) => setLightHoursOn(Number(e.target.value))}
                        className="w-full mt-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase">
                        Dimmer %
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={lightDimmer}
                        onChange={(e) => setLightDimmer(Number(e.target.value))}
                        className="w-full mt-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase">
                        Distance (in)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={lightDistance}
                        onChange={(e) =>
                          setLightDistance(
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        placeholder="—"
                        className="w-full mt-1 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleAdvance}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-bold flex items-center gap-2 transition-colors ${
              nextStage === "archived"
                ? "bg-zinc-800 hover:bg-zinc-700"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : nextStage === "archived" ? (
              "Archive Grow"
            ) : nextStage === "dry" ? (
              "Harvest & Start Dry"
            ) : (
              `Move to ${nextStage}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}