"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { createRoom } from "@/server/actions/facility-mgmt";

interface AddRoomModalProps {
  open: boolean;
  onClose: () => void;
  onRoomCreated: (room: { id: string; name: string }) => void;
}

export function AddRoomModal({ open, onClose, onRoomCreated }: AddRoomModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("tent");
  // Environmental targets (optional)
  const [targetTempF, setTargetTempF] = useState<number | "">("");
  const [targetRH, setTargetRH] = useState<number | "">("");
  const [targetVPD, setTargetVPD] = useState<number | "">("");
  const [lightOnTime, setLightOnTime] = useState("");
  const [lightOffTime, setLightOffTime] = useState("");
  const [ppfd, setPpfd] = useState<number | "">("");
  const [lightDistance, setLightDistance] = useState<number | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createRoom({
        name: name.trim(),
        type,
        targetTempF: targetTempF !== "" ? Number(targetTempF) : undefined,
        targetRH: targetRH !== "" ? Number(targetRH) : undefined,
        targetVPD: targetVPD !== "" ? Number(targetVPD) : undefined,
        lightOnTime: lightOnTime || undefined,
        lightOffTime: lightOffTime || undefined,
        ppfd: ppfd !== "" ? Number(ppfd) : undefined,
        lightDistance: lightDistance !== "" ? Number(lightDistance) : undefined,
      });
      if (!result.success || !result.room) {
        alert(result.error || "Failed to create room");
        return;
      }
      onRoomCreated({ id: result.room.id, name: result.room.name });
      // Reset form
      setName("");
      setType("tent");
      setTargetTempF("");
      setTargetRH("");
      setTargetVPD("");
      setLightOnTime("");
      setLightOffTime("");
      setPpfd("");
      setLightDistance("");
      setShowAdvanced(false);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Room</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Room Name */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Room Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Flower Tent A"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            >
              <option value="tent">Tent</option>
              <option value="room">Room</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showAdvanced ? "Hide Environmental Targets" : "Show Environmental Targets (Optional)"}
          </button>

          {/* Advanced Fields */}
          {showAdvanced && (
            <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">Target Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetTempF}
                    onChange={(e) => setTargetTempF(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="75.0"
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">Target RH (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetRH}
                    onChange={(e) => setTargetRH(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="60.0"
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-zinc-500">Target VPD (kPa)</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetVPD}
                  onChange={(e) => setTargetVPD(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="1.2"
                  className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">Light On</label>
                  <input
                    type="time"
                    value={lightOnTime}
                    onChange={(e) => setLightOnTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">Light Off</label>
                  <input
                    type="time"
                    value={lightOffTime}
                    onChange={(e) => setLightOffTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">PPFD</label>
                  <input
                    type="number"
                    value={ppfd}
                    onChange={(e) => setPpfd(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="800"
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-zinc-500">Light Distance (in)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lightDistance}
                    onChange={(e) => setLightDistance(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="18"
                    className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
                  />
                </div>
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
              Add Room
            </>
          )}
        </button>
      </div>
    </div>
  );
}