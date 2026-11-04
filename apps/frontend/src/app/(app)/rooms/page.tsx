import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { getLights } from "@/server/actions/lights";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { RoomsClient } from "./RoomsClient";

export default async function RoomsPage() {
  const userId = await getUserId();

  const [rooms, plants, lights] = await Promise.all([
    fetchRooms(),
    fetchPlants(),
    getLights(),
  ]);

  // Get the latest climate reading for each room
  const latestReadings = await db.climateLog.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    distinct: ["roomId"],
    select: {
      roomId: true,
      airTempC: true,
      relativeHumidity: true,
      timestamp: true,
    },
  });

  const readingByRoom: Record<string, any> = {};
  latestReadings.forEach((r) => {
    if (r.roomId) {
      // Convert Celsius to Fahrenheit for the UI
      const tempC = Number(r.airTempC);
      const tempF = (tempC * 9) / 5 + 32;
      readingByRoom[r.roomId] = {
        roomId: r.roomId,
        temperatureF: tempF,
        humidity: Number(r.relativeHumidity),
        timestamp: r.timestamp.toISOString(),
      };
    }
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