"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchRooms, updateRoom } from "@/server/actions/facility-mgmt";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { AddPlantModal } from "@/components/facility/AddPlantModal"; // fixed import path
import {
  Pencil,
  Check,
  X,
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
};

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Room>>({});

  const loadData = useCallback(async () => {
    if (!params?.id) return;
    try {
      const [roomsData, plantsData] = await Promise.all([
        fetchRooms(),
        fetchPlants(),
      ]);
      const foundRoom = roomsData.find((r: any) => r.id === params.id);
      if (foundRoom) {
        // Convert Decimal → number for all numeric fields
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
    } catch (err) {
      console.error("Failed to load room:", err);
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTargets = async () => {
    if (!room) return;
    // Prepare data to send – we only send the editable fields
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
      // Convert returned room (Prisma Decimal) to our Room type
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{room.name}</h1>
          <p className="text-zinc-400 text-sm">{room.type}</p>
        </div>
        <button
          onClick={() => setIsAddPlantModalOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          + Add Plant
        </button>
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
              <div key={plant.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">{plant.name}</p>
                  <p className="text-xs text-zinc-400">{plant.strain || "Unknown strain"}</p>
                </div>
                <span className="text-xs text-zinc-500">
                  {plant.batchId ? "In batch" : "No batch"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Plant Modal */}
      <AddPlantModal
        open={isAddPlantModalOpen}
        onClose={() => setIsAddPlantModalOpen(false)}
        rooms={[{ id: room.id, name: room.name }]}
        defaultRoomId={room.id}
        onPlantCreated={handlePlantCreated}
      />
    </div>
  );
}