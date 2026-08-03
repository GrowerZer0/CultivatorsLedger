// apps/frontend/src/app/%28app%29/rooms/page.tsx

import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { getLatestRoomReadings } from "@/server/actions/loggingreadings";
import { RoomsClient } from "./RoomsClient";

export default async function RoomsPage() {
  const [rooms, plants, latestReadings] = await Promise.all([
    fetchRooms(),
    fetchPlants(),
    getLatestRoomReadings(),
  ]);

  const plantCounts = plants.reduce((acc: Record<string, number>, plant: any) => {
    if (plant.roomId) {
      acc[plant.roomId] = (acc[plant.roomId] || 0) + 1;
    }
    return acc;
  }, {});

  return <RoomsClient rooms={rooms} plantCounts={plantCounts} latestReadings={latestReadings} />;
}