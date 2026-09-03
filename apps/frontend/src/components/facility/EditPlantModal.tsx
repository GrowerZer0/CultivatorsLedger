"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { updatePlant } from "@/server/actions/plant-mgmt";
import { GROWTH_STAGES, type GrowthStage } from "@/lib/growth-stages";

type Plant = {
  id: string;
  name: string;
  strain: string | null;
  roomId: string | null;
  batchId: string | null;
  wetWeight: number | null;
  dryTarget: number | null;
  containerGallons: number | null;
  currentWeight: number | null;
  mirrorPlantId: string | null;
  startDate: string | Date | null;
  stage: string | null;
};

type Room = { id: string; name: string };
type Batch = { id: string; name: string };

interface EditPlantModalProps {
  open: boolean;
  onClose: () => void;
  plant: Plant | null;
  rooms: Room[];
  batches: Batch[];
  allPlants?: Plant[];
  onPlantUpdated: (plant: Plant) => void;
}

// Helper to convert form value to number or null
function toNumberOrNull(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

export function EditPlantModal({
  open,
  onClose,
  plant,
  rooms,
  batches,
  allPlants = [],
  onPlantUpdated,
}: EditPlantModalProps) {
  const [formData, setFormData] = useState<Partial<Plant>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plant) {
      setFormData({
        name: plant.name,
        strain: plant.strain,
        roomId: plant.roomId,
        batchId: plant.batchId,
        wetWeight: plant.wetWeight,
        dryTarget: plant.dryTarget,
        containerGallons: plant.containerGallons,
        currentWeight: plant.currentWeight,
        mirrorPlantId: plant.mirrorPlantId,
        startDate: plant.startDate ? new Date(plant.startDate).toISOString().split('T')[0] : null,
        stage: plant.stage || null,
      });
    }
  }, [plant]);

  if (!open || !plant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build payload with proper type conversions
      const payload: any = {
        id: plant.id,
        name: formData.name,
        strain: formData.strain || null,
        roomId: formData.roomId || null,
        batchId: formData.batchId || null,
        mirrorPlantId: formData.mirrorPlantId || null,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        stage: formData.stage || null,
      };

      // Handle number fields with helper
      payload.wetWeight = toNumberOrNull(formData.wetWeight);
      payload.dryTarget = toNumberOrNull(formData.dryTarget);
      payload.containerGallons = toNumberOrNull(formData.containerGallons);
      payload.currentWeight = toNumberOrNull(formData.currentWeight);

      const result = await updatePlant(payload);

      if (result.success && result.plant) {
        onPlantUpdated(result.plant);
        onClose();
      } else {
        setError(result.error || "Failed to update plant");
      }
    } catch (err) {
      console.error("Update error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const mirrorOptions = allPlants.filter(p => p.id !== plant.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Edit Plant</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div>
            <label className="text-xs text-zinc-400">Plant Name</label>
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400">Strain</label>
            <input
              type="text"
              value={formData.strain || ""}
              onChange={(e) => setFormData({ ...formData, strain: e.target.value || null })}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Start Date & Growth Stage */}
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-xs font-semibold text-zinc-400 mb-3">📅 Growth Timeline</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate as string || ""}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value || null })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Growth Stage</label>
                <select
                  value={formData.stage || ""}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value || null })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Auto-detect</option>
                  {Object.entries(GROWTH_STAGES).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {formData.stage && GROWTH_STAGES[formData.stage as GrowthStage] && (
              <div className="mt-2 p-2 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-400">
                  {GROWTH_STAGES[formData.stage as GrowthStage]?.description}
                </p>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Room</label>
              <select
                value={formData.roomId || ""}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value || null })}
                className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">None</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Batch</label>
              <select
                value={formData.batchId || ""}
                onChange={(e) => setFormData({ ...formData, batchId: e.target.value || null })}
                className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">None</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Weight Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Container (gallons)</label>
              <input
                type="number"
                step="0.1"
                value={formData.containerGallons ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, containerGallons: val === '' ? null : parseFloat(val) });
                }}
                className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Wet Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.wetWeight ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, wetWeight: val === '' ? null : parseFloat(val) });
                }}
                className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. 18.5"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Dry Target (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={formData.dryTarget ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, dryTarget: val === '' ? null : parseFloat(val) });
              }}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              placeholder="e.g. 13.0"
            />
          </div>

          {/* Plant Mirroring */}
          <div className="border-t border-zinc-800 pt-4">
            <label className="text-xs text-zinc-400 flex items-center gap-2">
              <span>🔄 Mirror Weight From</span>
              <span className="text-[10px] text-zinc-500">(optional)</span>
            </label>
            <select
              value={formData.mirrorPlantId || ""}
              onChange={(e) => setFormData({ ...formData, mirrorPlantId: e.target.value || null })}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">None (use own weight)</option>
              {mirrorOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.currentWeight ? `(${Number(p.currentWeight).toFixed(1)} lbs)` : ''}
                </option>
              ))}
            </select>
            {formData.mirrorPlantId && (
              <p className="text-[10px] text-emerald-400 mt-1">
                ✅ This plant will mirror the weight of the selected plant
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
