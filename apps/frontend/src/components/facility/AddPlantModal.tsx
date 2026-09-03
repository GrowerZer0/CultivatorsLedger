"use client";

import { useState, useEffect } from "react";
import { X, Search, Plus, Loader2 } from "lucide-react";
import { createPlant } from "@/server/actions/plant-mgmt";

type Plant = {
  id: string;
  name: string;
  strain: string | null;
  roomId: string | null;
  batchId: string | null;
  currentWeight?: number | null; // Make currentWeight optional
};

type Room = { id: string; name: string };
type Batch = { id: string; name: string };

interface AddPlantModalProps {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  batches?: Batch[];
  defaultRoomId?: string;
  defaultBatchId?: string;
  onPlantCreated: (plant: any) => void;
  existingPlants?: Plant[];
  loadingPlants?: boolean;
  hideSelectExisting?: boolean;
}

export function AddPlantModal({
  open,
  onClose,
  rooms,
  batches = [],
  defaultRoomId,
  defaultBatchId,
  onPlantCreated,
  existingPlants = [],
  loadingPlants = false,
  hideSelectExisting = false,
}: AddPlantModalProps) {
  const [mode, setMode] = useState<'select' | 'create'>(
    hideSelectExisting ? 'create' : 'select'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: "",
    strain: "",
    roomId: defaultRoomId || "",
    batchId: defaultBatchId || "",
    containerGallons: "",
    wetWeight: "",
    dryTarget: "",
    mirrorPlantId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allPlants, setAllPlants] = useState<Plant[]>([]);

  // Fetch all plants for mirror selection
  useEffect(() => {
    if (open) {
      fetch('/api/plants')
        .then(res => res.json())
        .then(data => setAllPlants(data))
        .catch(err => console.error('Failed to fetch plants:', err));
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setMode(hideSelectExisting ? 'create' : 'select');
      setSearchTerm('');
      setFormData({
        name: "",
        strain: "",
        roomId: defaultRoomId || "",
        batchId: defaultBatchId || "",
        containerGallons: "",
        wetWeight: "",
        dryTarget: "",
        mirrorPlantId: "",
      });
      setError(null);
    }
  }, [open, defaultRoomId, defaultBatchId, hideSelectExisting]);

  if (!open) return null;

  const filteredPlants = existingPlants.filter(plant =>
    plant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (plant.strain && plant.strain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectPlant = (plant: Plant) => {
    onPlantCreated({
      ...plant,
      roomId: defaultRoomId || plant.roomId,
    });
    onClose();
  };

  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Plant name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createPlant({
        name: formData.name.trim(),
        strain: formData.strain.trim() || null,
        roomId: formData.roomId || null,
        batchId: formData.batchId || null,
        containerGallons: parseFloat(formData.containerGallons) || null,
        wetWeight: parseFloat(formData.wetWeight) || null,
        dryTarget: parseFloat(formData.dryTarget) || null,
        mirrorPlantId: formData.mirrorPlantId || null,
      });

      if (result.success && result.plant) {
        onPlantCreated(result.plant);
        onClose();
      } else {
        if ('error' in result && result.error) {
          setError(result.error);
        } else {
          setError("Failed to create plant");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fix: Use the current plant's id if editing, otherwise use a dummy value
  const mirrorOptions = allPlants.filter(p => p.id !== formData.mirrorPlantId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {hideSelectExisting ? 'Create New Plant' : 'Add Plant to Room'}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Mode Selection - only show if not hidden */}
        {!hideSelectExisting && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('select')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'select'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Select Existing
            </button>
            <button
              onClick={() => setMode('create')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'create'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Create New
            </button>
          </div>
        )}

        {/* Select Existing Plants */}
        {mode === 'select' && (
          <div className="space-y-3">
            {loadingPlants ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-emerald-400" />
                <span className="ml-2 text-sm text-zinc-400">Loading plants...</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search existing plants..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredPlants.length === 0 ? (
                    <div className="text-sm text-zinc-500 py-4 text-center">
                      {searchTerm ? 'No plants match your search' : 'No existing plants available to add'}
                      {!searchTerm && (
                        <div className="text-xs text-zinc-600 mt-2">
                          All plants are either already in this room or none exist yet.
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredPlants.map((plant) => (
                      <button
                        key={plant.id}
                        onClick={() => handleSelectPlant(plant)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">{plant.name}</div>
                          {plant.strain && (
                            <div className="text-xs text-zinc-400">{plant.strain}</div>
                          )}
                        </div>
                        <span className="text-xs text-emerald-400">Add →</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-800">
                  <button
                    onClick={() => setMode('create')}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-700 hover:border-emerald-500 text-zinc-400 hover:text-emerald-400 transition-colors text-sm"
                  >
                    <Plus className="size-4" />
                    Create new plant instead
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Create New Plant */}
        {mode === 'create' && (
          <form onSubmit={handleCreatePlant} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400">Plant Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Early Frost"
                className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400">Strain</label>
              <input
                type="text"
                value={formData.strain}
                onChange={(e) => setFormData({ ...formData, strain: e.target.value })}
                placeholder="e.g. Twenty20 Mendocino"
                className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Room</label>
                <select
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
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
                  value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">None</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Container (gal)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.containerGallons}
                  onChange={(e) => setFormData({ ...formData, containerGallons: e.target.value })}
                  placeholder="5"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Wet Weight</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.wetWeight}
                  onChange={(e) => setFormData({ ...formData, wetWeight: e.target.value })}
                  placeholder="lbs"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Dry Target</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.dryTarget}
                  onChange={(e) => setFormData({ ...formData, dryTarget: e.target.value })}
                  placeholder="lbs"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Mirror Plant Selection */}
            <div className="border-t border-zinc-800 pt-3">
              <label className="text-xs text-zinc-400 flex items-center gap-2">
                <span>🔄 Mirror Weight From</span>
                <span className="text-[10px] text-zinc-500">(optional)</span>
              </label>
              <select
                value={formData.mirrorPlantId}
                onChange={(e) => setFormData({ ...formData, mirrorPlantId: e.target.value })}
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
                {loading ? "Creating..." : "Create Plant"}
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
        )}
      </div>
    </div>
  );
}
