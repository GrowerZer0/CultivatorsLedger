//src/app/(app)/rooms/[id]/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { fetchRooms, updateRoom, deleteRoom } from "@/server/actions/facility-mgmt";
import { fetchPlants, updatePlant } from "@/server/actions/plant-mgmt";
import { fetchBatches } from "@/server/actions/batch-mgmt";
import { AddPlantModal } from "@/components/facility/AddPlantModal";
import { AddBatchModal } from "@/components/facility/AddBatchModal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EditPlantModal } from "@/components/facility/EditPlantModal";
import {
  Pencil,
  Check,
  X,
  Plus,
} from "lucide-react";

type Room = {
  id: string;
  name: string;
  type: string;
  targetTempF: number | null;
  targetRH: number | null;
  targetVPD: number | null;
  lightOnTime: string | null;
  lightOffTime: string | null;
  ppfd: number | null;
  lightDistance: number | null;
};

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

type Batch = {
  id: string;
  name: string;
};

type RoomOption = {
  id: string;
  name: string;
};

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isNewRoom = searchParams.get("new") === "true";
  const [room, setRoom] = useState<Room | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [allRooms, setAllRooms] = useState<RoomOption[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Room>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
  const [batchExists, setBatchExists] = useState(false);

  const loadData = useCallback(async () => {
    if (!params?.id) return;
    try {
      const [roomsData, plantsData, batchesData] = await Promise.all([
        fetchRooms(),
        fetchPlants(),
        fetchBatches(),
      ]);
      
      // Store all rooms and batches for dropdowns
      setAllRooms(roomsData);
      setAllBatches(batchesData);

      const foundRoom = roomsData.find((r: any) => r.id === params.id);
      if (foundRoom) {
        const roomForState: Room = {
          id: foundRoom.id,
          name: foundRoom.name,
          type: foundRoom.type,
          targetTempF: foundRoom.targetTempF ? Number(foundRoom.targetTempF) : null,
          targetRH: foundRoom.targetRH ? Number(foundRoom.targetRH) : null,
          targetVPD: foundRoom.targetVPD ? Number(foundRoom.targetVPD) : null,
          lightOnTime: foundRoom.lightOnTime,
          lightOffTime: foundRoom.lightOffTime,
          ppfd: foundRoom.ppfd ? Number(foundRoom.ppfd) : null,
          lightDistance: foundRoom.lightDistance ? Number(foundRoom.lightDistance) : null,
        };
        setRoom(roomForState);
        setEditForm({
          targetTempF: roomForState.targetTempF,
          targetRH: roomForState.targetRH,
          targetVPD: roomForState.targetVPD,
          lightOnTime: roomForState.lightOnTime,
          lightOffTime: roomForState.lightOffTime,
          ppfd: roomForState.ppfd,
          lightDistance: roomForState.lightDistance,
        });
      } else {
        setRoom(null);
      }
      setPlants(plantsData.filter((p: any) => p.roomId === params.id));

      const plantsForRoom = plantsData.filter((p: any) => p.roomId === params.id);
      setPlants(plantsForRoom);

      const hasBatch = plantsForRoom.some((p: any) => p.batchId !== null);
      setBatchExists(hasBatch);

    } catch (err) {
      console.error("Failed to load room:", err);
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

    // Auto-open plant modal if new room and no plants/batches exist
  useEffect(() => {
    if (isNewRoom && !loading && plants.length === 0) {
      // Show the batch creation prompt instead of auto-opening
      // The user will click the button
    }
  }, [isNewRoom, loading, plants.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTargets = async () => {
    if (!room) return;
    const updateData = {
      name: room.name,
      type: room.type,
      targetTempF: editForm.targetTempF ?? null,
      targetRH: editForm.targetRH ?? null,
      targetVPD: editForm.targetVPD ?? null,
      lightOnTime: editForm.lightOnTime ?? null,
      lightOffTime: editForm.lightOffTime ?? null,
      ppfd: editForm.ppfd ?? null,
      lightDistance: editForm.lightDistance ?? null,
    };
    const result = await updateRoom(room.id, updateData);
    if (result.success && result.room) {
      const updatedRoom: Room = {
        id: result.room.id,
        name: result.room.name,
        type: result.room.type,
        targetTempF: result.room.targetTempF ? Number(result.room.targetTempF) : null,
        targetRH: result.room.targetRH ? Number(result.room.targetRH) : null,
        targetVPD: result.room.targetVPD ? Number(result.room.targetVPD) : null,
        lightOnTime: result.room.lightOnTime,
        lightOffTime: result.room.lightOffTime,
        ppfd: result.room.ppfd ? Number(result.room.ppfd) : null,
        lightDistance: result.room.lightDistance ? Number(result.room.lightDistance) : null,
      };
      setRoom(updatedRoom);
      setIsEditing(false);
    } else {
      alert("Failed to update room targets.");
    }
  };

  const handlePlantCreated = useCallback((newPlant: any) => {
    setPlants((prev) => [...prev, newPlant]);
  }, []);

  const handleDeletePlant = useCallback(async (plantId: string) => {
    if (!confirm("Remove this plant from the room?")) return;
    // We just set roomId to null (unassign from room)
    const res = await updatePlant({
      id: plantId,
      roomId: null,
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
        Loading room...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-[75vh] items-center justify-center text-zinc-400">
        Room not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
            <Breadcrumbs
        segments={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Rooms", href: "/rooms" },
          { label: room.name, href: null },
        ]}
      />
      {/* ===== ONBOARDING PROMPT ===== */}
      {isNewRoom && plants.length === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 mb-4">
          <h3 className="text-lg font-bold text-white">🌱 Let's set up this room</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Start by creating a batch, then add plants to it.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => setIsAddBatchModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <Plus className="size-4" />
              Create Batch
            </button>
            <button
              onClick={() => {
                setIsAddPlantModalOpen(true);
              }}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <Plus className="size-4" />
              Skip – Add Plant
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            💡 A batch groups plants by harvest cycle. You can always add plants later.
          </p>
        </div>
      )}
    {/* ===== BATCH MISSING PROMPT (HAS PLANTS, NO BATCH) ===== */}
    {!isNewRoom && plants.length > 0 && !batchExists && (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
      <p className="text-sm text-yellow-400 font-medium">
        ⚡ Plants exist but no batch found. Create a batch to group them.
      </p>
      <button
        onClick={() => setIsAddBatchModalOpen(true)}
        className="mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-sm transition-colors"
      >
        Create Batch
      </button>
    </div>
  )}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{room.name}</h1>
          <p className="text-xs text-zinc-500 mt-1 text-left">
            {plants.length} plant{plants.length !== 1 ? "s" : ""}
          </p>
          <p>
          <button
            onClick={() => setIsAddPlantModalOpen(true)}
            className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            + Add Plant
          </button>
          </p>
        </div>
        <div>
        <button
          onClick={async () => {
            if (!confirm(`Delete room "${room.name}"? All plants and batches will be unassigned.`)) return;
            const res = await deleteRoom(room.id);
            if (res.success) {
              router.push("/rooms");
            } else {
              alert(res.error || "Failed to delete room.");
            }
          }}
            className=" bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 rounded-full transition-colors ml-2"
        >
          Delete Room
        </button>
        </div>
      </div>

      {/* Environmental Targets */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-zinc-400">Environmental Targets</h2>
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSaveTargets}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                <Check className="size-4" />
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    targetTempF: room.targetTempF,
                    targetRH: room.targetRH,
                    targetVPD: room.targetVPD,
                    lightOnTime: room.lightOnTime,
                    lightOffTime: room.lightOffTime,
                    ppfd: room.ppfd,
                    lightDistance: room.lightDistance,
                  });
                }}
                className="text-xs text-zinc-500 hover:text-zinc-400"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-zinc-500 hover:text-zinc-400"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] uppercase text-zinc-500">Temp °F</label>
              <input
                type="number"
                step="0.1"
                value={editForm.targetTempF ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, targetTempF: parseFloat(e.target.value) || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500">RH %</label>
              <input
                type="number"
                step="0.1"
                value={editForm.targetRH ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, targetRH: parseFloat(e.target.value) || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500">VPD kPa</label>
              <input
                type="number"
                step="0.01"
                value={editForm.targetVPD ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, targetVPD: parseFloat(e.target.value) || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500">PPFD</label>
              <input
                type="number"
                value={editForm.ppfd ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, ppfd: parseInt(e.target.value) || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500">Light On</label>
              <input
                type="time"
                value={editForm.lightOnTime ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, lightOnTime: e.target.value || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500">Light Off</label>
              <input
                type="time"
                value={editForm.lightOffTime ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, lightOffTime: e.target.value || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500">Light Distance (in)</label>
              <input
                type="number"
                step="0.1"
                value={editForm.lightDistance ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, lightDistance: parseFloat(e.target.value) || null })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 p-1.5 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Temp</span>
              <p className="text-white font-medium">
                {room.targetTempF ? `${room.targetTempF}°F` : "Not set"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">RH</span>
              <p className="text-white font-medium">
                {room.targetRH ? `${room.targetRH}%` : "Not set"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">VPD</span>
              <p className="text-white font-medium">
                {room.targetVPD ? `${room.targetVPD} kPa` : "Not set"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">PPFD</span>
              <p className="text-white font-medium">{room.ppfd || "Not set"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Light Schedule</span>
              <p className="text-white font-medium">
                {room.lightOnTime && room.lightOffTime
                  ? `${room.lightOnTime} – ${room.lightOffTime}`
                  : "Not set"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Light Distance</span>
              <p className="text-white font-medium">
                {room.lightDistance ? `${room.lightDistance} in` : "Not set"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Plants List */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-400 mb-3">Plants in this Room</h2>
        {plants.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-zinc-500">No plants assigned.</p>
            <p className="text-xs text-zinc-600 mt-1">Add plants to begin tracking.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {plants.map((plant) => (
              <div key={plant.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{plant.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span>{plant.strain || "Unknown strain"}</span>
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
                    {/* Move Room Dropdown */}
                    <select
                      value={plant.roomId || ""}
                      onChange={async (e) => {
                        const newRoomId = e.target.value || null;
                        const res = await updatePlant({
                          id: plant.id,
                          roomId: newRoomId,
                        });
                        if (res.success) {
                          setPlants((prev) =>
                            prev.map((p) =>
                              p.id === plant.id ? { ...p, roomId: newRoomId } : p
                            )
                          );
                        } else {
                          alert("Failed to move plant.");
                        }
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="">No Room</option>
                      {allRooms.map((r: RoomOption) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    {/* Move Batch Dropdown */}
                    <select
                      value={plant.batchId || ""}
                      onChange={async (e) => {
                        const newBatchId = e.target.value || null;
                        const res = await updatePlant({
                          id: plant.id,
                          batchId: newBatchId,
                        });
                        if (res.success) {
                          setPlants((prev) =>
                            prev.map((p) =>
                              p.id === plant.id ? { ...p, batchId: newBatchId } : p
                            )
                          );
                        } else {
                          alert("Failed to move batch.");
                        }
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="">No Batch</option>
                      {allBatches.map((b: Batch) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePlant(plant.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Add Plant Modal */}
      <AddPlantModal
        open={isAddPlantModalOpen}
        onClose={() => setIsAddPlantModalOpen(false)}
        rooms={[{ id: room.id, name: room.name }]}
        defaultRoomId={room.id}
        onPlantCreated={(plant) =>
          setPlants((prev) => [...prev, plant as Plant])
        }
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

      {/* Add Batch Modal */}
        <AddBatchModal
        open={isAddBatchModalOpen}
        onClose={() => setIsAddBatchModalOpen(false)}
        rooms={[{ id: room.id, name: room.name }]}
        onBatchCreated={(batch) => {
          // Redirect to the new batch
          window.location.href = `/batches/${batch.id}?new=true`;
        }}
      />
    </div>
  );
}