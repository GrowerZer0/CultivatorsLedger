// src/app/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getRequiredUserId } from "@/lib/session";
import { DryBackLog, EnvironmentReading } from "@/lib/cultivation";

// Helper: compute VPD (kPa) from temp (°C) and RH (%)
function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  const vpd = es - ea;
  return Math.round(vpd * 100) / 100;
}

export async function getDashboardData() {
  const userId = await getRequiredUserId();

  const climateLogs = await db.climateLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 30,
  });

  const latestBatch = await db.batchHarvest.findFirst({
    orderBy: { startDate: "desc" },
  });

  // Fallback values
  const defaultWetWeight = 18.4;
  const defaultDryTarget = 13.2;
  const wetWeight = latestBatch?.totalDryYieldG
    ? Number(latestBatch.totalDryYieldG) * 0.00220462 // grams to lbs
    : defaultWetWeight;
  const dryTargetWeight = latestBatch?.totalDryYieldG
    ? Number(latestBatch.totalDryYieldG) * 0.0015 // placeholder logic
    : defaultDryTarget;

  // Build dryBackLogs – match the DryBackLog type exactly
  const dryBackLogs: DryBackLog[] = climateLogs.map((log) => {
    const dryBackPercent = Math.min(100, Math.max(0, 100 - Number(log.relativeHumidity)));
    return {
      id: String(log.id), // convert to string
      cultivar: log.zoneId || "Unknown", // required field – use zoneId as cultivar
      stage: log.zoneId || "Main",
      containerGallons: 5,
      wetWeight: wetWeight,
      dryTargetWeight: dryTargetWeight,
      weight: dryBackPercent,
      dryBackPercent: dryBackPercent,
      runoff_ec: 0,
      loggedAt: log.timestamp.toISOString(),
    };
  });

  // Build environmentReadings – match the EnvironmentReading type exactly
  const environmentReadings: EnvironmentReading[] = climateLogs.map((log) => ({
    id: String(log.id),
    temperatureF: Number(log.airTempC) * 9/5 + 32,
    temperature: Number(log.airTempC),
    humidity: Number(log.relativeHumidity),
    vpd: log.calculatedVpdKpa
      ? Number(log.calculatedVpdKpa)
      : computeVPD(Number(log.airTempC), Number(log.relativeHumidity)),
    runoff_ec: 0,
    dry_back: 0,
    recordedAt: log.timestamp.toISOString(),
  }));

  return {
    environmentReadings,
    dryBackLogs,
  };
}



export async function addManualClimateLog(data: {
  temperature: number;
  humidity: number;
  timestamp?: Date;
}) {
  const userId = await getRequiredUserId(); // local bypass in dev

  const result = await db.climateLog.create({
    data: {
      airTempC: data.temperature,
      relativeHumidity: data.humidity,
      timestamp: data.timestamp || new Date(),
      isManualEntry: true,
      roomId: "Manual Entry",
      zoneId: "Manual",
      leafOffsetC: 2.0,
    },
  });

  revalidatePath("/");
  return { success: true, id: result.id };
}

// Stubbed functions (to satisfy imports)
export async function addDryBackLog(data: any) {
  console.warn("addDryBackLog stubbed");
  return { success: false };
}

export async function getUserProfile() {
  return null;
}

export async function updateUserProfile(data: any) {
  return null;
}

export async function getCustomBlueprints() {
  return [];
}

export async function saveOrUpdateBlueprint(blueprint: any) {
  return { success: false };
}

export async function deleteCustomBlueprint(id: string) {
  return { success: false };
}