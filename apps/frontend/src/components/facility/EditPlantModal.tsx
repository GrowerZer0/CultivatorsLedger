//apps/frontend/src/components/facility/EditPlantModal.tsx

"use client";

import { useState, useEffect, useTransition } from "react";
import { X, Loader2, Upload } from "lucide-react";
import { updatePlant } from "@/server/actions/plant-mgmt";

interface RoomOption {
  id: string;
  name: string;
}

interface BatchOption {
  id: string;
  name: string;
}

interface PlantData {
  id: string;
  name: string;
  strain: string | null;
  roomId: string | null;
  batchId: string | null;
  wetWeight: number | null;
  dryTarget: number | null;
  containerGallons: number | null;
  currentWeight: number | null;
}

interface EditPlantModalProps {
  open: boolean;
  onClose: () => void;
  plant: PlantData | null;
  rooms: RoomOption[];
  batches: BatchOption[];
  onPlantUpdated: (updatedPlant: PlantData) => void;
}

export function EditPlantModal({
  open,
  onClose,
  plant,
  rooms,
  batches,
  onPlantUpdated,
}: EditPlantModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [roomId, setRoomId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [wetWeight, setWetWeight] = useState<number | "">("");
  const [dryTarget, setDryTarget] = useState<number | "">("");
  const [containerGallons, setContainerGallons] = useState<number | "">("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Populate form when plant changes
  useEffect(() => {
    if (plant) {
      setName(plant.name || "");
      setStrain(plant.strain || "");
      setRoomId(plant.roomId || "");
      setBatchId(plant.batchId || "");
      setWetWeight(plant.wetWeight ?? "");
      setDryTarget(plant.dryTarget ?? "");
      setContainerGallons(plant.containerGallons ?? "");
      setPhotoFile(null); // reset file input
    }
  }, [plant]);

  if (!open || !plant) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const payload = {
        id: plant.id,
        name: name.trim(),
        strain: strain.trim() || null,
        roomId: roomId || null,
        batchId: batchId || null,
        wetWeight: wetWeight !== "" ? Number(wetWeight) : null,
        dryTarget: dryTarget !== "" ? Number(dryTarget) : null,
        containerGallons: containerGallons !== "" ? Number(containerGallons) : null,
      };
      const result = await updatePlant(payload);
      if (result.success && result.plant) {
        // Convert result to PlantData shape
        const updated: PlantData = {
          id: result.plant.id,
          name: result.plant.name,
          strain: result.plant.strain,
          roomId: result.plant.roomId,
          batchId: result.plant.batchId,
          wetWeight: result.plant.wetWeight !== null ? Number(result.plant.wetWeight) : null,
          dryTarget: result.plant.dryTarget !== null ? Number(result.plant.dryTarget) : null,
          containerGallons: result.plant.containerGallons !== null ? Number(result.plant.containerGallons) : null,
          currentWeight: result.plant.currentWeight !== null ? Number(result.plant.currentWeight) : null,
        };
        onPlantUpdated(updated);
        onClose();
      } else {
        alert(result.error || "Failed to update plant.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Plant</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Plant Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blue Dream #1"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>

          {/* Strain */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Strain</label>
            <input
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>

          {/* Room */}
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

          {/* Batch */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Batch</label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            >
              <option value="">No Batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>

          {/* Wet Weight */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Wet Weight (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={wetWeight}
              onChange={(e) => setWetWeight(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 18.4"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>

          {/* Dry Target */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Dry Target (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={dryTarget}
              onChange={(e) => setDryTarget(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 13.2"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>

          {/* Container Gallons */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Container (Gallons)</label>
            <input
              type="number"
              step="0.5"
              value={containerGallons}
              onChange={(e) => setContainerGallons(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 5"
              className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-800"
            />
          </div>

          {/* Current Weight (read-only) */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Current Weight (lbs)</label>
            <input
              value={plant.currentWeight !== null ? plant.currentWeight : "N/A"}
              disabled
              className="mt-1 w-full rounded-lg border p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            />
          </div>

          {/* Photo Upload (placeholder) */}
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Photo</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPhotoFile(e.target.files[0]);
                  }
                }}
                className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-900/30 dark:file:text-emerald-400"
              />
              {photoFile && <span className="text-xs text-emerald-500">{photoFile.name}</span>}
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Upload a photo (placeholder – not saved yet)</p>
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
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </div>
  );
}
