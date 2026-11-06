"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { saveLight } from "@/server/actions/lights";

interface AddLightModalProps {
  open: boolean;
  onClose: () => void;
  onLightCreated: (light: { id: string; name: string }) => void;
}

export function AddLightModal({
  open,
  onClose,
  onLightCreated,
}: AddLightModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [wattage, setWattage] = useState<number | "">("");
  const [scheduleHoursOn, setScheduleHoursOn] = useState<number>(18);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dimmerPercent, setDimmerPercent] = useState<number>(100);
  const [distanceInches, setDistanceInches] = useState<number | "">("");
  const [type, setType] = useState("led_full_spectrum");

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Light name is required.");
      return;
    }
    if (wattage === "") {
      alert("Wattage is required.");
      return;
    }

    startTransition(async () => {
      const res = await saveLight({
        name: name.trim(),
        wattage: Number(wattage),
        type,
        dimmerPercent,
        distanceInches: distanceInches === "" ? null : Number(distanceInches),
        scheduleHoursOn,
      });

      if (!res.success || !res.light) {
        alert(res.error || "Failed to create light");
        return;
      }

      onLightCreated({ id: res.light.id, name: res.light.name });

      // Reset
      setName("");
      setWattage("");
      setScheduleHoursOn(18);
      setDimmerPercent(100);
      setDistanceInches("");
      setType("led_full_spectrum");
      setShowAdvanced(false);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Light</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Light Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HLG 350R"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Wattage (W)
              </label>
              <input
                type="number"
                min={1}
                value={wattage}
                onChange={(e) =>
                  setWattage(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="350"
                className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Hours On
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={scheduleHoursOn}
                onChange={(e) => setScheduleHoursOn(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
          >
            {showAdvanced ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            {showAdvanced ? "Hide Advanced" : "Show Advanced (Optional)"}
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">
                    Dimmer %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={dimmerPercent}
                    onChange={(e) => setDimmerPercent(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">
                    Distance (in)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={distanceInches}
                    onChange={(e) =>
                      setDistanceInches(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="24"
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-zinc-500">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                >
                  <option value="led_full_spectrum">LED Full Spectrum</option>
                  <option value="led_bloom">LED Bloom</option>
                  <option value="cmh">CMH</option>
                  <option value="hps">HPS</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 font-bold disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Adding...
            </>
          ) : (
            <>
              <Plus size={18} />
              Add Light
            </>
          )}
        </button>
      </div>
    </div>
  );
}