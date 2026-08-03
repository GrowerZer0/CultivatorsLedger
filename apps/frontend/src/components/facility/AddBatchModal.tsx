//src/components/facility/AddBatchModal.tsx
"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { createBatch } from "@/server/actions/batch-mgmt";

interface RoomOption {
  id: string;
  name: string;
}

interface AddBatchModalProps {
  open: boolean;
  onClose: () => void;
  rooms: RoomOption[];
  onBatchCreated: (batch: { id: string; name: string }) => void;
}

export function AddBatchModal({
  open,
  onClose,
  rooms,
  onBatchCreated,
}: AddBatchModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [cultivar, setCultivar] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState("");

  if (!open) return null;

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createBatch({
        name: name.trim(),
        cultivar: cultivar.trim() || "Unknown",
        roomId: roomId || undefined,
        startDate: startDate || undefined,
        isActive: true,
      });
      if (!result.success || !result.batch) {
        alert(result.error || "Failed to create batch");
        return;
      }
      onBatchCreated({ id: result.batch.id, name: result.batch.name });
      setName("");
      setCultivar("");
      setRoomId("");
      setStartDate("");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Create Batch</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Batch Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Blue Dream - Summer 2026"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Cultivar</label>
            <input
              value={cultivar}
              onChange={(e) => setCultivar(e.target.value)}
              placeholder="e.g., Blue Dream"
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
            <label className="text-xs font-bold uppercase text-zinc-500">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
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
              Create Batch
            </>
          )}
        </button>
      </div>
    </div>
  );
}