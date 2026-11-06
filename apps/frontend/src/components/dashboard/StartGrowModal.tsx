"use client";

import { useEffect, useState } from "react";
import { Sprout, X, Loader2, Lightbulb, Scale } from "lucide-react";
import { createPlant } from "@/server/actions/plant-mgmt";
import { createRoom } from "@/server/actions/facility-mgmt";
import { createBatch } from "@/server/actions/batch-mgmt";
import { saveLight } from "@/server/actions/lights";
import { useRouter } from "next/navigation";
import {
  getAvailableLoadCells,
  assignSensorToPlant,
} from "@/server/actions/sensors";

interface StartGrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  lights: { id: string; name: string }[];
}

interface SensorOption {
  id: string;
  name: string;
  type: string;
}

export function StartGrowModal({
  isOpen,
  onClose,
  rooms: initialRooms,
  batches: initialBatches,
  lights: initialLights,
}: StartGrowModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [roomId, setRoomId] = useState("");
  const [batchId, setBatchId] = useState("");

  const [rooms, setRooms] = useState(initialRooms);
  const [batches, setBatches] = useState(initialBatches);
  const [lights, setLights] = useState(initialLights);
  const [lightId, setLightId] = useState("");

  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchCultivar, setNewBatchCultivar] = useState("");

  const [isAddingLight, setIsAddingLight] = useState(false);
  const [newLightName, setNewLightName] = useState("");
  const [newLightWattage, setNewLightWattage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const [sensors, setSensors] = useState<SensorOption[]>([]);
const [loadCellId, setLoadCellId] = useState("");
const [sensorsLoading, setSensorsLoading] = useState(false);

useEffect(() => {
  if (!isOpen) return;
  let cancelled = false;
  setSensorsLoading(true);
  getAvailableLoadCells()
    .then((rows) => {
      if (cancelled) return;
      setSensors(rows);
      const small = rows.find((s) => /small/i.test(s.name));
      if (small) setLoadCellId(small.id);
    })
    .catch((err) => {
        console.error("Failed to fetch load cells:", err);
      if (!cancelled) setSensors([]);
    })
    .finally(() => {
      if (!cancelled) setSensorsLoading(false);
    });
  return () => {
    cancelled = true;
  };
}, [isOpen]);

  // ─── inline creators ────────────────────────────────────────────
  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    setLoading(true);
    setError(null);
    try {
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
    if (!newBatchName.trim()) {
      setError("Batch name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createBatch({
        name: newBatchName.trim(),
        cultivar: newBatchCultivar.trim() || null,
      });
      const newBatch = (res as any).batch || res;
      if ((res as any).success && newBatch) {
        setBatches([...batches, newBatch]);
        setBatchId(newBatch.id);
        setIsAddingBatch(false);
        setNewBatchName("");
        setNewBatchCultivar("");
      } else {
        setError((res as any).error || "Failed to create batch");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLight = async () => {
    if (!newLightName.trim()) {
      setError("Light name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await saveLight({
        name: newLightName.trim(),
        wattage: Number(newLightWattage) || 100,
        type: "led_full_spectrum",
        dimmerPercent: 100,
        distanceInches: null,
        scheduleHoursOn: 18,
      });
      if (!res.success || !res.light) {
        throw new Error(res.error || "Failed to create light");
      }
      setLights([...lights, { id: res.light.id, name: res.light.name }]);
      setLightId(res.light.id);
      setIsAddingLight(false);
      setNewLightName("");
      setNewLightWattage("");
    } catch (err: any) {
      setError(err.message || "Failed to create light");
    } finally {
      setLoading(false);
    }
  };

  // ─── submit ─────────────────────────────────────────────────────
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

    if (!res.success) {
      setLoading(false);
      setError(res.error || "Failed to start grow.");
      return;
    }

    if (loadCellId && res.success) {
  await assignSensorToPlant({
    sensorId: loadCellId,
    plantId: res.plant.id,
  });
}

    setLoading(false);
    onClose();
    router.push(`/plants/${res.plant.id}`);
    router.refresh();
  };

    if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Start New Grow
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* NAME */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">
              Plant Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Early Frost #1"
              className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              autoFocus
            />
          </div>

          {/* STRAIN */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">
              Strain (optional)
            </label>
            <input
              type="text"
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="e.g. Twenty20 Mendocino"
              className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
            />
          </div>

          {/* ROOM */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">
                Room
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddingRoom(!isAddingRoom);
                  setIsAddingBatch(false);
                  setIsAddingLight(false);
                }}
                className="text-[10px] text-emerald-500 font-bold hover:underline"
              >
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
                <button
                  type="button"
                  onClick={handleAddRoom}
                  disabled={loading}
                  className="px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ) : (
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              >
                <option value="">No Room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* BATCH — cultivar optional */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">
                Batch (optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddingBatch(!isAddingBatch);
                  setIsAddingRoom(false);
                  setIsAddingLight(false);
                }}
                className="text-[10px] text-emerald-500 font-bold hover:underline"
              >
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
                    placeholder="Cultivar (optional)"
                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddBatch}
                    disabled={loading}
                    className="px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              >
                <option value="">No Batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* LIGHT — with inline Add Light */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                <Lightbulb className="size-3.5" /> Light (optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddingLight(!isAddingLight);
                  setIsAddingRoom(false);
                  setIsAddingBatch(false);
                }}
                className="text-[10px] text-emerald-500 font-bold hover:underline"
              >
                {isAddingLight ? "Cancel" : "+ New Light"}
              </button>
            </div>

            {isAddingLight ? (
              <div className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <input
                  type="text"
                  value={newLightName}
                  onChange={(e) => setNewLightName(e.target.value)}
                  placeholder="Light name (e.g. HLG 350R)"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={newLightWattage}
                    onChange={(e) => setNewLightWattage(e.target.value)}
                    placeholder="Wattage (e.g. 350)"
                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddLight}
                    disabled={loading}
                    className="px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={lightId}
                onChange={(e) => setLightId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              >
                <option value="">No Light</option>
                {lights.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </div>
{/* LOAD CELL */}
<div>
  <div className="flex items-center justify-between mb-1">
    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
      <Scale className="size-3.5" /> Load Cell (optional)
    </label>
    <a
      href="/settings/hardware"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-emerald-500 font-bold hover:underline"
    >
      Manage sensors →
    </a>
  </div>
  {sensorsLoading ? (
    <div className="text-[11px] text-zinc-500 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
      Loading available scales…
    </div>
  ) : sensors.length === 0 ? (
    <div className="text-[11px] text-zinc-500 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
      No unassigned load cells.{" "}
      <a
        href="/settings/hardware"
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-500 font-bold hover:underline"
      >
        Add one
      </a>{" "}
      then come back.
    </div>
  ) : (
    <select
      value={loadCellId}
      onChange={(e) => setLoadCellId(e.target.value)}
      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
    >
      <option value="">No scale assigned</option>
      {sensors.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  )}
</div>

          {error && <p className="text-xs text-red-500 font-bold">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-zinc-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Start Seedling"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}