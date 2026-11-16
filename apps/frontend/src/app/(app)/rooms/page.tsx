import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { getLights } from "@/server/actions/lights";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { RoomsClient } from "./RoomsClient";
import { getLatestRoomReadings } from "@/server/actions/loggingreadings";

export default async function RoomsPage() {
  const userId = await getUserId();

  const [rooms, plants, lights] = await Promise.all([
    fetchRooms(),
    fetchPlants(),
    getLights(),
  ]);

  // Get the latest climate reading for each room (Optimized to return only 3 rows)
const latestReadingsMap = await getLatestRoomReadings();

  // Get the latest climate reading for each room
const latestReadings = Object.entries(latestReadingsMap).map(([roomId, data]) => ({
  roomId,
  airTempC: data.airTempC,
  relativeHumidity: data.relativeHumidity,
  timestamp: data.timestamp,
}));

  const readingByRoom: Record<string, any> = {};
  latestReadings.forEach((r) => {
    // A room with no climate reading has no roomId/timestamp pair to
    // display. Skip it rather than fabricate a reading.
    if (!r.roomId || !r.timestamp) return;
    // Convert Celsius to Fahrenheit for the UI
    const tempC = Number(r.airTempC);
    const tempF = (tempC * 9) / 5 + 32;
    readingByRoom[r.roomId] = {
      roomId: r.roomId,
      temperatureF: tempF,
      humidity: Number(r.relativeHumidity),
      timestamp: r.timestamp.toISOString(),
    };
  });

  // Count plants per room
  const plantCounts = plants.reduce((acc: Record<string, number>, plant: any) => {
    if (plant.roomId) {
      acc[plant.roomId] = (acc[plant.roomId] || 0) + 1;
    }
    return acc;
  }, {});

   // Skip lights for now (Light has no roomId)
  const lightsByRoom: Record<string, any[]> = {};

  return (
    <RoomsClient
      rooms={rooms}
      plantCounts={plantCounts}
      latestReadings={readingByRoom}
      lightsByRoom={lightsByRoom}
    />
  );
}