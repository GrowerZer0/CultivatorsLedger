"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Plus, Loader2, Save } from "lucide-react";
import { createPlant, updatePlant } from "@/server/actions/plant-mgmt";

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
  strain?: string | null;
  roomId?: string | null;
  batchId?: string | null;
  containerGallons?: number | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  currentWeight?: number | null;
}

interface AddPlantModalProps {
  open: boolean;
  onClose: () => void;
  rooms: RoomOption[];
  batches?: BatchOption[];
  defaultRoomId?: string;
  defaultBatchId?: string;
  plant?: PlantData | null;
  onPlantCreated?: (plant: PlantData) => void;
  onPlantUpdated?: (plant: PlantData) => void;
}

export function AddPlantModal({
  open,
  onClose,
  rooms,
  batches = [],
  defaultRoomId,
  defaultBatchId,
  plant,
  onPlantCreated,
  onPlantUpdated,
}: AddPlantModalProps) {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [roomId, setRoomId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [containerGallons, setContainerGallons] = useState("");
  const [wetWeight, setWetWeight] = useState("");
  const [dryTarget, setDryTarget] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");

  const isEditing = Boolean(plant?.id);

  useEffect(() => {
    if (!open) return;

    setName(plant?.name ?? "");
    setStrain(plant?.strain ?? "");
    setRoomId(
      plant?.roomId ??
      (defaultRoomId && rooms.some((r) => r.id === defaultRoomId)
        ? defaultRoomId
        : "")
    );
    setBatchId(plant?.batchId ?? defaultBatchId ?? "");
    setContainerGallons(
      plant?.containerGallons != null ? String(plant.containerGallons) : ""
    );
    setWetWeight(
      plant?.wetWeight != null ? String(plant.wetWeight) : ""
    );
    setDryTarget(
      plant?.dryTarget != null ? String(plant.dryTarget) : ""
    );
    setCurrentWeight(
      plant?.currentWeight != null ? String(plant.currentWeight) : ""
    );
  }, [open, plant, defaultRoomId, defaultBatchId, rooms]);

  if (!open) return null;

  function handleSubmit() {
    if (!name.trim()) return;

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        strain: strain.trim() || null,
        roomId: roomId || null,
        batchId: batchId || null,
        containerGallons: containerGallons
          ? Number(containerGallons)
          : null,
        wetWeight: wetWeight ? Number(wetWeight) : null,
        dryTarget: dryTarget ? Number(dryTarget) : null,
        currentWeight: currentWeight ? Number(currentWeight) : null,
      };

      const result = isEditing
        ? await updatePlant({
            id: plant!.id,
            ...payload,
          })
        : await createPlant(payload);

      if (!result.success) {
        alert(result.error);
        return;
      }

      if (isEditing) {
        onPlantUpdated?.(result.plant);
      } else {
        onPlantCreated?.(result.plant);
      }

      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {isEditing
              ? "Edit Plant"
              : defaultBatchId
                ? "Add Plant to Batch"
                : "Add Plant"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Plant Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Blue Dream #1"
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Strain
            </label>
            <input
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Room
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
            >
              <option value="">No Room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Batch
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
            >
              <option value="">No Batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Container (gal)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={containerGallons}
                onChange={(e) => setContainerGallons(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Wet Weight
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={wetWeight}
                onChange={(e) => setWetWeight(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Dry Target
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={dryTarget}
                onChange={(e) => setDryTarget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
              />
            </div>

            {isEditing && (
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">
                  Current Weight
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 dark:bg-zinc-800"
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !name.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-canopy text-white py-2.5 font-bold disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Saving...
            </>
          ) : isEditing ? (
            <>
              <Save size={18} />
              Save Changes
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
