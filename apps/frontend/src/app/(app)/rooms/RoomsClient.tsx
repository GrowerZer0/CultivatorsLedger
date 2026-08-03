// apps/frontend/src/app/(app)/rooms/RoomsClient.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { RoomCard } from "@/components/facility/RoomCard";
import { AddRoomModal } from "@/components/facility/AddRoomModal";

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
}

export function RoomsClient({ rooms, plantCounts, latestReadings }: RoomsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localRooms, setLocalRooms] = useState(rooms);

  const handleRoomCreated = (newRoom: { id: string; name: string }) => {
    // Optimistically add to list (or refetch)
    setLocalRooms((prev) => [
      ...prev,
      { ...newRoom, type: "tent", targetTempF: null, targetRH: null, targetVPD: null, lightOnTime: null, lightOffTime: null, ppfd: null, lightDistance: null },
    ]);
  };

  if (localRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
          No rooms yet.
        </h2>
        <p className="mt-2 text-gray-500 dark:text-zinc-400 max-w-md">
          Create your first room to start tracking plants.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          Add Room
        </button>
        <AddRoomModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRoomCreated={handleRoomCreated}
        />
      </div>
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
          <RoomCard
            key={room.id}
            id={room.id}
            name={room.name}
            type={room.type}
            plantCount={plantCounts[room.id] || 0}
            latestReading={latestReadings[room.id] || null}
          />
        ))}
      </div>

      <AddRoomModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
}