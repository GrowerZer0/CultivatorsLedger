// apps/frontend/src/app/(app)/rooms/page.tsx

import { RoomCard } from "@/components/facility/RoomCard";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { getLatestRoomReadings } from "@/server/actions/loggingreadings";
import Link from "next/link";

export default async function RoomsPage() {
  const [rooms, plants, latestReadings] = await Promise.all([
    fetchRooms(),
    fetchPlants(),
    getLatestRoomReadings(), // we'll build this server action
  ]);

  // Build a map: roomId -> plant count
  const plantCounts = plants.reduce((acc: Record<string, number>, plant: any) => {
    if (plant.roomId) {
      acc[plant.roomId] = (acc[plant.roomId] || 0) + 1;
    }
    return acc;
  }, {});

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
          No rooms yet.
        </h2>
        <p className="mt-2 text-gray-500 dark:text-zinc-400 max-w-md">
          Create your first room to start tracking plants.
        </p>
        <Link
          href="/settings/facility" // or you can use a client‑side modal trigger
          className="mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          Add Room
        </Link>
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
        <Link
          href="/settings/facility"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          + Add Room
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room: any) => (
          <RoomCard
            key={room.id}
            id={room.id}
            name={room.name}
            type={room.type}
            plantCount={plantCounts[room.id] || 0}
            latestReading={latestReadings[room.id]}
          />
        ))}
      </div>
    </div>
  );
}