"use client";

import { useState } from "react";
import { Sprout, X, Loader2, Lightbulb } from "lucide-react";
import { createPlant } from "@/server/actions/plant-mgmt";
import { createRoom } from "@/server/actions/facility-mgmt";
import { createBatch } from "@/server/actions/batch-mgmt";
import { useRouter } from "next/navigation";

interface StartGrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  lights: { id: string; name: string }[];
}

export function StartGrowModal({ isOpen, onClose, rooms: initialRooms, batches: initialBatches, lights: initialLights }: StartGrowModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [roomId, setRoomId] = useState("");
  const [batchId, setBatchId] = useState("");
  
  // Local state for inline creation
  const [rooms, setRooms] = useState(initialRooms);
  const [batches, setBatches] = useState(initialBatches);
  const [lights, setLights] = useState(initialLights);
  const [lightId, setLightId] = useState("");
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchCultivar, setNewBatchCultivar] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // createRoom expects an object now
      const res = await createRoom({ name: newRoomName.trim() });
      if (res.success && res.room) {
        setRooms([...rooms, res.room]);
        setRoomId(res.room.id);
        setIsAddingRoom(false);
        setNewRoomName("");
      } else {
        setError(res.error || "Failed to create room");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBatch = async () => {
    if (!newBatchName.trim() || !newBatchCultivar.trim()) {
      setError("Batch name and cultivar are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // createBatch expects { name, cultivar }
      const res = await createBatch({ 
        name: newBatchName.trim(),
        cultivar: newBatchCultivar.trim()
      });
      // Depending on your action, it might return `batch` or `id`
      const newBatch = res.batch || res;
      if (res.success && newBatch) {
        setBatches([...batches, newBatch]);
        setBatchId(newBatch.id);
        setIsAddingBatch(false);
        setNewBatchName("");
        setNewBatchCultivar("");
      } else {
        setError(res.error || "Failed to create batch");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Plant name is required.");

    setLoading(true);
    setError(null);

    const res = await createPlant({
      name: name.trim(),
      strain: strain.trim() || null,
      roomId: roomId || null,
      batchId: batchId || null,
      lightId: lightId || null, 
      stage: "seedling",
      startDate: new Date(),
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to start grow.");
      return;
    }

    onClose();
    router.push(`/plants/${res.plant.id}`);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Start New Grow</h3>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">Plant Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Early Frost #1"
              className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">Strain (optional)</label>
            <input
              type="text"
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="e.g. Twenty20 Mendocino"
              className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
            />
          </div>

          {/* ROOM SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">Room</label>
              <button type="button" onClick={() => { setIsAddingRoom(!isAddingRoom); setIsAddingBatch(false); }} className="text-[10px] text-emerald-500 font-bold hover:underline">
                {isAddingRoom ? "Cancel" : "+ New Room"}
              </button>
            </div>
            
            {isAddingRoom ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Vivosun 2x4"
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
                />
                <button type="button" onClick={handleAddRoom} disabled={loading} className="px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
              </div>
            ) : (
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm">
                <option value="">No Room</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>

          {/* BATCH SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">Batch (optional)</label>
              <button type="button" onClick={() => { setIsAddingBatch(!isAddingBatch); setIsAddingRoom(false); }} className="text-[10px] text-emerald-500 font-bold hover:underline">
                {isAddingBatch ? "Cancel" : "+ New Batch"}
              </button>
            </div>
            
            {isAddingBatch ? (
              <div className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="Batch Name (e.g. Winter 2026)"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBatchCultivar}
                    onChange={(e) => setNewBatchCultivar(e.target.value)}
                    placeholder="Cultivar (required)"
                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                  />
                  <button type="button" onClick={handleAddBatch} disabled={loading} className="px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
                </div>
              </div>
            ) : (
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm">
                <option value="">No Batch</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

                    {/* LIGHT SELECTION */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5 mb-1">
              <Lightbulb className="size-3.5" /> Light (optional)
            </label>
            <select value={lightId} onChange={(e) => setLightId(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm">
              <option value="">No Light</option>
              {lights.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-red-500 font-bold">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-bold text-zinc-500">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Start Seedling"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}