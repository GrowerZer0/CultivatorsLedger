'use client';

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getBatch, updateBatch, deleteBatch, fetchBatches } from "@/server/actions/batch-mgmt";
import { getPlantsForBatch, updatePlant } from "@/server/actions/plant-mgmt";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import { AddPlantModal } from "@/components/facility/AddPlantModal";
import { EditPlantModal } from "@/components/facility/EditPlantModal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Pencil, Plus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
};

type RoomOption = {
  id: string;
  name: string;
};

type BatchOption = {
  id: string;
  name: string;
};

type Batch = {
  id: string;
  name: string;
  cultivar: string | null;
  roomId: string | null;
  startDate: string | Date;
  dryBackLogs: any[];
};

export default function BatchPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isNewBatch = searchParams.get("new") === "true";
  const router = useRouter();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [allRooms, setAllRooms] = useState<RoomOption[]>([]);
  const [allBatches, setAllBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [editStartDate, setEditStartDate] = useState<string | Date | null>(null);

  const loadData = useCallback(async () => {
    if (!params?.id) return;
    try {
      const [batchData, plantsData, roomsData, batchesData] = await Promise.all([
        getBatch(params.id),
        getPlantsForBatch(params.id),
        fetchRooms(),
        fetchBatches(),
      ]);

      setBatch(batchData);
      setPlants(plantsData);
      setRooms(roomsData);
      setAllRooms(roomsData);
      setAllBatches(batchesData);
    } catch (err) {
      console.error("Failed to load batch data:", err);
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  // Update editStartDate when batch changes
  useEffect(() => {
    if (batch) {
      setEditStartDate(batch.startDate || null);
    }
  }, [batch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlantCreated = useCallback((newPlant: any) => {
    setPlants((prev) => [...prev, newPlant]);
    if (params?.id) {
      getPlantsForBatch(params.id).then(setPlants);
    }
  }, [params?.id]);

  const handleDeletePlant = useCallback(async (plantId: string) => {
    if (!confirm("Remove this plant from the batch?")) return;
    const res = await updatePlant({
      id: plantId,
      batchId: null,
    });
    if (res.success) {
      setPlants((prev) => prev.filter((p) => p.id !== plantId));
    } else {
      alert("Failed to remove plant.");
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-[75vh] items-center justify-center text-zinc-400">
        Loading batch...
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex h-[75vh] items-center justify-center text-zinc-400">
        Batch not found.
      </div>
    );
  }

  const avgDryBack =
    batch.dryBackLogs?.length > 0
      ? batch.dryBackLogs.reduce((acc: number, log: any) => acc + Number(log.dryBackPercent), 0) /
        batch.dryBackLogs.length
      : 0;

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const chartData =
    batch.dryBackLogs?.map((log: any) => ({
      time: new Date(log.timestamp).toLocaleDateString(),
      dryBack: Number(log.dryBackPercent),
    })) || [];

  const exportCSV = () => {
    if (!batch?.dryBackLogs?.length) return;
    const headers = ['Date', 'Dry-Back %'];
    const rows = batch.dryBackLogs.map((log: any) => [
      new Date(log.timestamp).toLocaleDateString(),
      Number(log.dryBackPercent).toFixed(1),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch.name}_dryback_logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Breadcrumbs
        segments={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Batches", href: "/batches" },
          { label: batch.name, href: null },
        ]}
      />

      {/* ===== ONBOARDING PROMPT FOR NEW BATCH ===== */}
      {isNewBatch && plants.length === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 mb-4">
          <h3 className="text-lg font-bold text-white">🌱 Batch created!</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Now add plants to this batch to start tracking.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => setIsAddPlantModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <Plus className="size-4" />
              Add Plant
            </button>
            <Link
              href={`/rooms/${batch.roomId || ""}`}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-lg text-sm transition-colors"
            >
              Go to Room
            </Link>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            💡 You can add multiple plants to this batch. Each plant will share the same harvest cycle.
          </p>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{batch.name}</h1>
            <p className="text-zinc-400 flex items-center gap-3 flex-wrap">
              {batch.cultivar && <span>{batch.cultivar}</span>}
              {batch.roomId && <span>• Room: {batch.roomId}</span>}

              {/* Move Room Dropdown */}
              <select
                value={batch.roomId || ""}
                onChange={async (e) => {
                  const newRoomId = e.target.value || null;
                  const res = await updateBatch(batch.id, { roomId: newRoomId });
                  if (res.success && res.batch) {
                    setBatch((prev) => prev ? { ...prev, roomId: newRoomId } : null);
                  } else {
                    alert("Failed to move batch.");
                  }
                }}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">No Room</option>
                {allRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              {/* Export CSV */}
              <button
                onClick={exportCSV}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full transition-colors"
              >
                Export CSV
              </button>

              {/* Delete Batch */}
              <button
                onClick={async () => {
                  if (!confirm(`Delete batch "${batch.name}"? All plants and logs will be unassigned.`)) return;
                  const res = await deleteBatch(batch.id);
                  if (res.success) {
                    router.push("/batches");
                  } else {
                    alert(res.error || "Failed to delete batch.");
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-bold rounded-full transition-colors"
              >
                Delete Batch
              </button>
            </p>
          </div>
        </div>

        {/* ===== START DATE EDIT ===== */}
        <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
          <span>Started:</span>
          {isEditingStartDate ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={editStartDate ? new Date(editStartDate).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
              />
              <button
                onClick={async () => {
                  const res = await updateBatch(batch.id, { startDate: editStartDate });
                  if (res.success && res.batch) {
                    setBatch({ ...batch, startDate: res.batch.startDate });
                    setIsEditingStartDate(false);
                  } else {
                    alert("Failed to update start date.");
                  }
                }}
                className="text-emerald-400 hover:text-emerald-300 text-xs"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingStartDate(false);
                  setEditStartDate(batch.startDate || null);
                }}
                className="text-zinc-500 hover:text-zinc-400 text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingStartDate(true)}
              className="text-white hover:text-emerald-400 transition-colors"
            >
              {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : 'Not set'}
              <span className="text-zinc-500 ml-1 text-xs">(edit)</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">Days Since Start</p>
          <p className="text-2xl font-bold text-white">{daysSinceStart}</p>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">Average Dry-Back</p>
          <p className="text-2xl font-bold text-white">{avgDryBack.toFixed(1)}%</p>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">Logs Recorded</p>
          <p className="text-2xl font-bold text-white">{batch.dryBackLogs?.length || 0}</p>
        </div>
      </div>

      {/* Dry-Back Chart */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-400 mb-3">Dry-Back Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="time" stroke="#4B5563" fontSize={12} />
            <YAxis stroke="#4B5563" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }} />
            <Line type="monotone" dataKey="dryBack" stroke="#10B981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Plants Section */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-zinc-400">Plants in this Batch</h2>
          <button
            onClick={() => setIsAddPlantModalOpen(true)}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add Plant
          </button>
        </div>

        {plants.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-zinc-500">No plants assigned.</p>
            <p className="text-xs text-zinc-600 mt-1">Add plants to begin daily check‑ins.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {plants.map((plant) => {
              const room = rooms.find((r) => r.id === plant.roomId);
              return (
                <div key={plant.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">{plant.name}</p>
                    <div className="flex gap-3 text-xs text-zinc-400">
                      <span>{plant.strain || "Unknown strain"}</span>
                      {room && <span>• {room.name}</span>}
                      <button
                        onClick={() => {
                          setEditingPlant(plant);
                          setIsEditModalOpen(true);
                        }}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Edit plant details"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePlant(plant.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Plant Modal */}
      <AddPlantModal
        open={isAddPlantModalOpen}
        onClose={() => setIsAddPlantModalOpen(false)}
        rooms={rooms}
        defaultBatchId={batch.id}
        onPlantCreated={(plant) => {
          setPlants((prev) => [...prev, plant as Plant]);
        }}
      />

      {/* Edit Plant Modal */}
      <EditPlantModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPlant(null);
        }}
        plant={editingPlant}
        rooms={allRooms}
        batches={allBatches}
        onPlantUpdated={(updated) => {
          setPlants((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
        }}
      />
    </div>
  );
}