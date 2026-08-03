// src/components/AddPlantModal.tsx

"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { createPlant } from "@/server/actions/plant-mgmt";

interface RoomOption {
  id: string;
  name: string;
}

interface AddPlantModalProps {
  open: boolean;
  onClose: () => void;
  rooms: RoomOption[];
  defaultRoomId?: string;
  defaultBatchId?: string; // NEW: pre-assign to a batch
  onPlantCreated: (plant: {
    id: string;
    name: string;
    roomId?: string | null;
    batchId?: string | null;
  }) => void;
}

export function AddPlantModal({
  open,
  onClose,
  rooms,
  defaultRoomId,
  defaultBatchId,
  onPlantCreated,
}: AddPlantModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [roomId, setRoomId] = useState(
    defaultRoomId && rooms.some(r => r.id === defaultRoomId)
      ? defaultRoomId
      : ""
  );
  // We don't expose batchId in the UI – it's passed via prop.
  if (!open) return null;

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createPlant({
        name: name.trim(),
        strain: strain.trim() || undefined,
        roomId: roomId || undefined,
        batchId: defaultBatchId || undefined, // pass batch if provided
      });
      if (!result.success || !result.plant) {
        alert(result.error || "Failed to create plant");
        return;
      }
      onPlantCreated({
        id: result.plant.id,
        name: result.plant.name,
        roomId: result.plant.roomId,
        batchId: result.plant.batchId,
      });
      setName("");
      setStrain("");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {defaultBatchId ? "Add Plant to Batch" : "Add Plant"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Plant Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Blue Dream #1"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Strain</label>
            <input
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            >
              <option value="">No Room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-canopy text-white py-2.5 font-bold disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Creating...
            </>
          ) : (
            <>
              <Plus size={18} />
              Add Plant
            </>
          )}
        </button>
      </div>
    </div>
  );
}