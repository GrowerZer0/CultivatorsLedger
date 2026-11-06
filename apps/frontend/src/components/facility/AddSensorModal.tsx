"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { createSensor } from "@/server/actions/sensorconfig";

interface AddSensorModalProps {
  open: boolean;
  onClose: () => void;
  onSensorCreated: (sensor: { id: string; name: string; apiKey: string; type: string }) => void;
}

export function AddSensorModal({
  open,
  onClose,
  onSensorCreated,
}: AddSensorModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("esp32-loadcell");

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Device name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createSensor({
          name: name.trim(),
          type,
        });

        if (!result?.apiKey) {
          alert("Failed to create sensor.");
          return;
        }

        onSensorCreated({
          id: result.id,
          name: result.name,
          apiKey: result.apiKey,
          type,
        });

        setName("");
        setType("esp32-loadcell");
        onClose();
      } catch (err) {
        console.error("Failed to add sensor:", err);
        alert("Failed to add sensor.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Device</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Device Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Small Load Cell"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Device Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800 text-sm"
            >
              <option value="esp32-loadcell">ESP32 Load Cell</option>
              <option value="esp32-environmental">ESP32 Environmental</option>
              <option value="custom-http">Custom HTTP</option>
              <option value="vivosun">VIVOSUN</option>
              <option value="mqtt">MQTT</option>
            </select>
            <p className="text-[10px] text-zinc-500 mt-1">
              You&apos;ll get an API key after creating this device. Paste it into
              your ESP32 firmware to start sending data.
            </p>
          </div>
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
              Add Device
            </>
          )}
        </button>
      </div>
    </div>
  );
}