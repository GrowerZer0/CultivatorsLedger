//src/components/facility/AddRoomModal.tsx
"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2 } from "lucide-react";
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

  if (!open) return null;

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createRoom({ name: name.trim(), type });
      if (!result.success || !result.room) {
        alert(result.error || "Failed to create room");
        return;
      }
      onRoomCreated({ id: result.room.id, name: result.room.name });
      setName("");
      setType("tent");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Room</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Room Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Flower Tent A"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>
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
        </div>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-canopy text-white py-2.5 font-bold disabled:opacity-50"
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