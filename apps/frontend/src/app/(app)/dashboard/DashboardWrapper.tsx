import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import DashboardClient from "./DashboardClient";
import { getPhotoUrls } from "@/server/actions/photos";
import type { SensorStatus } from "@/components/dashboard/SensorStatusBanner";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchBatches } from "@/server/actions/batch-mgmt";
import { getLights } from "@/server/actions/lights";
import { getActionCenterData } from "@/server/actions/action-center";

export default async function DashboardWrapper() {
  const userId = await getUserId();

  const [
    plants,
    recentLogs,
    sensorConfigs,
    latestWeight,
    latestClimate,
    rooms,
    batches,
    lights,
    actionItems,
    roomClimateReadings
  ] = await Promise.all([
    db.plant.findMany({
      where: { userId, archivedAt: null },
      include: {
        dryBackLogs: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
        light: {
          select: { id: true, name: true, wattage: true, dimmerPercent: true },
        },
        photos: {
          orderBy: { capturedAt: "desc" },
          take: 1,
          select: { storagePath: true },
        },
        sensorConfigs: {
          select: { id: true, name: true, type: true },
        },
        stageEvents: {
          where: { endedAt: null },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    }),
    db.dryBackLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
    db.sensorConfig.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, type: true, lastPingAt: true },
    }),
    db.dryBackLog.findFirst({
      where: { userId, source: "esp32" },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
    db.climateLog.findFirst({
      where: { userId, sourceType: "sht45" },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
    fetchRooms(),
    fetchBatches(),
    getLights(),
    getActionCenterData(),
    db.climateLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      distinct: ["roomId"],
      select: {
        roomId: true,
        airTempC: true,
        relativeHumidity: true,
        timestamp: true,
      },
    }),
  ]);

  const thumbPaths = plants
    .map((p) => p.photos[0]?.storagePath)
    .filter((p): p is string => !!p);
  const thumbUrls = await getPhotoUrls(thumbPaths);

  const formattedPlants = plants.map((plant) => ({
    id: plant.id,
    name: plant.name,
    strain: plant.strain,
    breeder: plant.breeder,
    roomId: plant.roomId,
    batchId: plant.batchId,
    wetWeight: plant.wetWeight ? Number(plant.wetWeight) : null,
    dryTarget: plant.dryTarget ? Number(plant.dryTarget) : null,
    containerGallons: plant.containerGallons ? Number(plant.containerGallons) : null,
    stage: plant.stage,
    sensorConfigs: plant.sensorConfigs || [],
    flipDate: plant.flipDate ? plant.flipDate.toISOString() : null,
    startDate: plant.startDate ? plant.startDate.toISOString() : null,
    currentWeight: plant.dryBackLogs[0]
      ? Number(plant.dryBackLogs[0].currentWeightLbs)
      : null,
    currentWeightTimestamp: plant.dryBackLogs[0]
      ? plant.dryBackLogs[0].timestamp.toISOString()
      : null,
    thumbnailUrl: plant.photos[0]?.storagePath
      ? thumbUrls[plant.photos[0].storagePath] ?? null
      : null,
    light: plant.light
      ? {
        id: plant.light.id,
        name: plant.light.name,
        wattage: Number(plant.light.wattage),
        dimmerPercent: Number(plant.light.dimmerPercent),
      }
      : null,
    updatedAt: plant.updatedAt ? plant.updatedAt.toISOString() : null,
    currentStageStartedAt: plant.stageEvents?.[0]?.startedAt?.toISOString() ?? null,
  }));

  const alerts = plants
    .map((plant) => {
      const log = plant.dryBackLogs[0];
      if (!log) return null;
      const dryback = Number(log.dryBackPercent);
      if (dryback > 80) return `${plant.name} needs irrigation (${dryback.toFixed(1)}% dryback)`;
      return null;
    })
    .filter(Boolean) as string[];

  const formattedLogs = recentLogs.map((log) => ({
    id: log.id,
    description: `Weight: ${Number(log.currentWeightLbs)} lbs (${Number(log.dryBackPercent).toFixed(1)}% dryback)`,
    timestamp: log.timestamp,
  }));
    // Map latest climate readings by roomId, converting Celsius to Fahrenheit
  const roomReadingsByRoom: Record<string, any> = {};
  roomClimateReadings.forEach((r) => {
    if (r.roomId) {
      const tempC = Number(r.airTempC);
      const tempF = (tempC * 9) / 5 + 32;
      roomReadingsByRoom[r.roomId] = {
        roomId: r.roomId,
        temperatureF: tempF,
        humidity: Number(r.relativeHumidity),
        timestamp: r.timestamp.toISOString(),
      };
    }
  });

  // Group lights by room (Light currently has no roomId, so this is empty for now)
  const lightsByRoom: Record<string, any[]> = {};

  const sensorStatus: SensorStatus[] = [];

  const hasLoadCell = sensorConfigs.some((s) =>
    /load|weight|esp32/i.test(s.name + " " + s.type),
  );
  if (hasLoadCell) {
    sensorStatus.push({
      id: "loadcell",
      name: "Load cell",
      type: "weight",
      lastPingAt: latestWeight?.timestamp
        ? latestWeight.timestamp.toISOString()
        : null,
    });
  }

  const hasClimate = sensorConfigs.some((s) =>
    /sht|env|climate/i.test(s.name + " " + s.type),
  );
  if (hasClimate) {
    sensorStatus.push({
      id: "sht45",
      name: "SHT45",
      type: "environmental",
      lastPingAt: latestClimate?.timestamp
        ? latestClimate.timestamp.toISOString()
        : null,
    });
  }

  return (
    <DashboardClient
      initialData={{
        plants: formattedPlants,
        recentLogs: formattedLogs,
        alerts,
        summary: `${plants.length} plants, ${recentLogs.length} recent logs`,
        sensorStatus,
        rooms: rooms,
        batches: batches,
        lights: lights,
actionItems: actionItems.items,
activePlantCount: actionItems.activePlantCount,
        roomClimateReadings: roomReadingsByRoom,
        lightsByRoom,
      }}
    />
  );
}