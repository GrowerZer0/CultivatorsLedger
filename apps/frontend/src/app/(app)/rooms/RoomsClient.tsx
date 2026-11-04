"use client";

import { useState } from "react";
import { Home } from "lucide-react";
import { AddRoomModal } from "@/components/facility/AddRoomModal";
import { AddPlantModal } from "@/components/plants/AddPlantModal";
import { RoomSummary } from "@/components/rooms/RoomSummary";
import { deleteRoom } from "@/server/actions/facility-mgmt";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { EmptyState } from "@/components/ui/EmptyState";

interface Room {
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
}

interface RoomsClientProps {
  rooms: Room[];
  plantCounts: Record<string, number>;
  latestReadings: Record<string, any>;
  lightsByRoom: Record<string, any[]>;
}

export function RoomsClient({
  rooms,
  plantCounts,
  latestReadings,
  lightsByRoom,
}: RoomsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localRooms, setLocalRooms] = useState(rooms);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [existingPlants, setExistingPlants] = useState<any[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);

  const handleOpenAddPlant = async (roomId: string) => {
    setSelectedRoomId(roomId);
    setLoadingPlants(true);
    try {
      const plants = await fetchPlants();
      const plantsNotInRoom = plants.filter((p: any) => p.roomId !== roomId);
      setExistingPlants(plantsNotInRoom);
    } catch (error) {
      console.error("Failed to fetch plants:", error);
      setExistingPlants([]);
    } finally {
      setLoadingPlants(false);
    }
    setShowAddPlant(true);
  };

  const handleRoomCreated = (newRoom: { id: string; name: string }) => {
    setLocalRooms((prev) => [
      ...prev,
      {
        ...newRoom,
        type: "tent",
        targetTempF: null,
        targetRH: null,
        targetVPD: null,
        lightOnTime: null,
        lightOffTime: null,
        ppfd: null,
        lightDistance: null,
      },
    ]);
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (
      !confirm(
        `Delete "${roomName}"? This will unassign all plants and batches in this room.`,
      )
    )
      return;

    setDeletingId(roomId);
    const result = await deleteRoom(roomId);
    setDeletingId(null);

    if (result.success) {
      setLocalRooms((prev) => prev.filter((r) => r.id !== roomId));
    } else {
      alert(result.error || "Failed to delete room");
    }
  };

  if (localRooms.length === 0) {
    return (
      <>
        <EmptyState
          icon={Home}
          title="No rooms yet"
          description="Rooms group your plants by environment. Create one to start tracking temperature, humidity, and VPD targets."
          action={{
            label: "Create Your First Room",
            onClick: () => setIsModalOpen(true),
          }}
        />
        <AddRoomModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRoomCreated={handleRoomCreated}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
            Rooms
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Manage your grow spaces and their environmental targets.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          + Add Room
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {localRooms.map((room) => (
          <RoomSummary
            key={room.id}
            room={room}
            plantCount={plantCounts[room.id] || 0}
            latestReading={latestReadings[room.id] || null}
            lights={lightsByRoom[room.id] || []}
            variant="card"
            onDelete={handleDeleteRoom}
            isDeleting={deletingId === room.id}
          />
        ))}
      </div>

      <AddRoomModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />

      <AddPlantModal
        open={showAddPlant}
        onClose={() => setShowAddPlant(false)}
        rooms={localRooms}
        defaultRoomId={selectedRoomId || undefined}
        existingPlants={existingPlants}
        loadingPlants={loadingPlants}
        onPlantCreated={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}