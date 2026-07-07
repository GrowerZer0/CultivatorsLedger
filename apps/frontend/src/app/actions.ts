// src/app/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getRequiredUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from '@prisma/client';
import { generateDemoData } from "@/lib/demoData";

// Helper: compute VPD (kPa) from temp (°C) and RH (%)
function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  const vpd = es - ea;
  return Math.round(vpd * 100) / 100;
}

export async function getDashboardData() {
    // 🧪 Demo Mode – bypass database and return mock data
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      const demoData = generateDemoData(24);
      const latest = demoData[demoData.length - 1];
    
    return {
      environmentReadings: demoData.map(d => ({
        id: String(Math.random()),
        temperatureF: d.temperature * 9/5 + 32,
        temperature: d.temperature,
        humidity: d.humidity,
        vpd: d.vpd,
        runoff_ec: 0,
        dry_back: 0,
        recordedAt: d.timestamp.toISOString(),
      })),
      dryBackLogs: demoData.map(d => ({
        id: String(Math.random()),
        cultivar: "Demo Grow",
        stage: "Flower",
        containerGallons: 5,
        wetWeight: 18.4,
        dryTargetWeight: 13.2,
        weight: d.weight || 14.5,
        dryBackPercent: ((18.4 - (d.weight || 14.5)) / (18.4 - 13.2)) * 100,
        runoff_ec: 0,
        loggedAt: d.timestamp.toISOString(),
      })),
      // For live data, we also return the latest climate reading
      latestClimate: {
        airTempC: latest.temperature,
        relativeHumidity: latest.humidity,
        calculatedVpdKpa: latest.vpd,
        timestamp: latest.timestamp,
      },
    };
  }
  
  const userId = await getRequiredUserId();

  // Fetch the 30 most recent climate logs (descending)
  const climateLogs = await db.climateLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 30,
  });

  // Reverse to get ascending order for charts (oldest → newest)
  const sortedLogs = [...climateLogs].reverse();

  // Build environmentReadings from sorted logs
  const environmentReadings = sortedLogs.map((log) => ({
    id: String(log.id),
    temperatureF: Number(log.airTempC) * 9/5 + 32,
    temperature: Number(log.airTempC),
    humidity: Number(log.relativeHumidity),
    vpd: log.calculatedVpdKpa ? Number(log.calculatedVpdKpa) : computeVPD(Number(log.airTempC), Number(log.relativeHumidity)),
    runoff_ec: 0,
    dry_back: 0,
    recordedAt: log.timestamp.toISOString(),
  }));

  // Fetch real dry‑back logs from the new table
  const dryBackLogsFromDb = await db.dryBackLog.findMany({
    orderBy: { timestamp: "asc" },
    take: 30,
  });

  // Map to the DryBackLog type expected by the frontend
  const dryBackLogs = dryBackLogsFromDb.map((log: PrismaDryBackLog) => ({
    id: String(log.id),
    cultivar: "Batch", // could later link to batch
    stage: "Main",
    containerGallons: Number(log.containerGallons),
    wetWeight: Number(log.wetWeightLbs),
    dryTargetWeight: Number(log.dryTargetWeightLbs),
    weight: Number(log.currentWeightLbs),
    dryBackPercent: Number(log.dryBackPercent),
    runoff_ec: log.runoffEc ? Number(log.runoffEc) : 0,
    loggedAt: log.timestamp.toISOString(),
    unit: log.unit || "lbs",
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

export async function addDryBackLog(data: {
  cultivar: string;
  containerGallons: number;
  wetWeight: number;
  dryTargetWeight: number;
  weight: number;
  runoff_ec: number;
  unit: string;
}) {
  const userId = await getRequiredUserId();
  const dryBackPercent = ((data.wetWeight - data.weight) / (data.wetWeight - data.dryTargetWeight)) * 100;
  const clampedPercent = Math.max(0, Math.min(100, dryBackPercent));

  const result = await db.dryBackLog.create({
    data: {
      containerGallons: data.containerGallons,
      wetWeightLbs: data.wetWeight,
      dryTargetWeightLbs: data.dryTargetWeight,
      currentWeightLbs: data.weight,
      dryBackPercent: clampedPercent,
      runoffEc: data.runoff_ec || null,
      notes: `Cultivar: ${data.cultivar}`,
      timestamp: new Date(),
    },
  });

  revalidatePath("/");
  return { success: true, id: result.id };
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