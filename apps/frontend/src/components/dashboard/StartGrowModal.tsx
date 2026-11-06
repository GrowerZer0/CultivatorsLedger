"use client";

import { useEffect, useState } from "react";
import { Sprout, X, Loader2, Lightbulb, Scale, Home } from "lucide-react";
import { createPlant } from "@/server/actions/plant-mgmt";
import { useRouter } from "next/navigation";
import {
  getAvailableLoadCells,
  assignSensorToPlant,
} from "@/server/actions/sensors";
import { AddRoomModal } from "@/components/facility/AddRoomModal";
import { AddLightModal } from "@/components/facility/AddLightModal";
import { AddSensorModal } from "@/components/facility/AddSensorModal";

interface StartGrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: { id: string; name: string }[];
  batches?: { id: string; name: string }[];
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
  lights: initialLights,
}: StartGrowModalProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [breeder, setBreeder] = useState("");
  const [roomId, setRoomId] = useState("");
  const [lightId, setLightId] = useState("");
  const [loadCellId, setLoadCellId] = useState("");

  const [rooms, setRooms] = useState(initialRooms);
  const [lights, setLights] = useState(initialLights);

  const [sensors, setSensors] = useState<SensorOption[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nested modal state
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddLight, setShowAddLight] = useState(false);
  const [showAddSensor, setShowAddSensor] = useState(false);

  // Load cells fetch
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

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setStrain("");
      setBreeder("");
      setRoomId("");
      setLightId("");
      setLoadCellId("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Plant name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createPlant({
      name: name.trim(),
      strain: strain.trim() || null,
      // breeder — add once the schema field exists
      roomId: roomId || null,
      batchId: null,
      lightId: lightId || null,
      stage: "seedling",
      startDate: new Date(),
    });

    if (!res.success) {
      setLoading(false);
      setError(res.error || "Failed to start grow.");
      return;
    }

    if (loadCellId) {
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

  return (
    <>
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
                placeholder="e.g. Plant #1"
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
                placeholder="e.g. Early Frost"
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              />
            </div>

            {/* BREEDER */}
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase">
                Breeder (optional)
              </label>
              <input
                type="text"
                value={breeder}
                onChange={(e) => setBreeder(e.target.value)}
                placeholder="e.g. Twenty20 Mendocino"
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg text-sm"
              />
            </div>

            {/* ROOM */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                  <Home className="size-3.5" /> Room (optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddRoom(true)}
                  className="text-[10px] text-emerald-500 font-bold hover:underline"
                >
                  + New Room
                </button>
              </div>
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
            </div>

            {/* LIGHT */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                  <Lightbulb className="size-3.5" /> Light (optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddLight(true)}
                  className="text-[10px] text-emerald-500 font-bold hover:underline"
                >
                  + New Light
                </button>
              </div>
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
            </div>

            {/* LOAD CELL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                  <Scale className="size-3.5" /> Load Cell (optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddSensor(true)}
                  className="text-[10px] text-emerald-500 font-bold hover:underline"
                >
                  + New Load Cell
                </button>
              </div>
              {sensorsLoading ? (
                <div className="text-[11px] text-zinc-500 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  Loading available scales…
                </div>
              ) : sensors.length === 0 ? (
                <div className="text-[11px] text-zinc-500 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  No unassigned load cells.{" "}
                  <button
                    type="button"
                    onClick={() => setShowAddSensor(true)}
                    className="text-emerald-500 font-bold hover:underline"
                  >
                    Create one
                  </button>{" "}
                  to assign it now.
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

            {error && (
              <p className="text-xs text-red-500 font-bold">{error}</p>
            )}

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

      {/* Nested modals */}
      <AddRoomModal
        open={showAddRoom}
        onClose={() => setShowAddRoom(false)}
        onRoomCreated={(room) => {
          setRooms((prev) => [...prev, room]);
          setRoomId(room.id);
          setShowAddRoom(false);
        }}
      />
      <AddLightModal
        open={showAddLight}
        onClose={() => setShowAddLight(false)}
        onLightCreated={(light) => {
          setLights((prev) => [...prev, light]);
          setLightId(light.id);
          setShowAddLight(false);
        }}
      />
      <AddSensorModal
        open={showAddSensor}
        onClose={() => setShowAddSensor(false)}
        onSensorCreated={(sensor) => {
          // Add to available sensors if it's a load cell
          if (sensor.type === "esp32-loadcell") {
            setSensors((prev) => [
              ...prev,
              { id: sensor.id, name: sensor.name, type: sensor.type },
            ]);
            setLoadCellId(sensor.id);
          }
          setShowAddSensor(false);
          // Show the API key alert so the user can copy it
          alert(
            `Device created!\n\nAPI Key: ${sensor.apiKey}\n\nCopy this key now and paste it into your ESP32 firmware. It won't be shown again.`,
          );
        }}
      />
    </>
  );
}