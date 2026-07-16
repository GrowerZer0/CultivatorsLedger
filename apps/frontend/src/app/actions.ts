// src/app/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from '@prisma/client';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { GoogleGenAI } from "@google/genai";

// Helper: compute VPD (kPa) from temp (°C) and RH (%)
function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  const vpd = es - ea;
  return Math.round(vpd * 100) / 100;
}

// Helper to hash API keys
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Generate a new API key (32 hex chars)
function generateApiKey(): string {
  return randomBytes(16).toString('hex');
}

// --- SENSOR CONFIG CRUD ---

export async function getSensors() {
  const userId = await getUserId();
  return await db.sensorConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSensor(data: { name: string; type: string }) {
  const userId = await getUserId();
  const apiKey = generateApiKey();
  const apiKeyHash = hashKey(apiKey);
  const sensor = await db.sensorConfig.create({
    data: {
      name: data.name,
      type: data.type,
      apiKeyHash,
      isActive: true,
      userId,
    },
  });
  // Return the plain API key (only once) to show to the user
  return { ...sensor, apiKey };
}

export async function toggleSensor(sensorId: string, isActive: boolean) {
  const userId = await getUserId();
  // Ensure the sensor belongs to the user
  const existing = await db.sensorConfig.findFirst({
    where: { id: sensorId, userId },
  });
  if (!existing) throw new Error('Sensor not found or unauthorized');
  return await db.sensorConfig.update({
    where: { id: sensorId },
    data: { isActive },
  });
}

export async function deleteSensor(sensorId: string) {
  const userId = await getUserId();
  // Ensure the sensor belongs to the user
  const existing = await db.sensorConfig.findFirst({
    where: { id: sensorId, userId },
  });
  if (!existing) throw new Error('Sensor not found or unauthorized');
  return await db.sensorConfig.delete({ where: { id: sensorId } });
}

export async function regenerateApiKey(sensorId: string) {
  const userId = await getUserId();
  // Ensure the sensor belongs to the user
  const existing = await db.sensorConfig.findFirst({
    where: { id: sensorId, userId },
  });
  if (!existing) throw new Error('Sensor not found or unauthorized');
  const newKey = generateApiKey();
  const newHash = hashKey(newKey);
  const updated = await db.sensorConfig.update({
    where: { id: sensorId },
    data: { apiKeyHash: newHash },
  });
  return { ...updated, apiKey: newKey };
}

export async function getDashboardData(batchId?: string, plantId?: string) {
  const userId = await getUserId();

  // Fetch the 30 most recent climate logs (descending)
  const climateLogs = await db.climateLog.findMany({
    where: { userId },
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

  // Fetch real dry‑back logs from the new table (optionally filtered by batch)
  const dryBackLogsFromDb = await db.dryBackLog.findMany({
    where: {
      userId,
      ...(batchId ? { batchId } : {}),
      ...(plantId ? { plantId } : {}),
    },
    orderBy: { timestamp: "asc" },
    take: 30,
  });

  // Map to the DryBackLog type expected by the frontend
  const dryBackLogs = dryBackLogsFromDb.map((log: PrismaDryBackLog) => ({
    id: String(log.id),
    cultivar: "Batch", 
    stage: "Main",
    containerGallons: Number(log.containerGallons),
    wetWeight: Number(log.wetWeightLbs),
    dryTarget: Number(log.dryTargetWeightLbs),
    weight: Number(log.currentWeightLbs),
    dryBackPercent: Number(log.dryBackPercent),
    runoff_ec: log.runoffEc ? Number(log.runoffEc) : 0,
    loggedAt: log.timestamp.toISOString(),
    unit: log.unit || "lbs",
    source: (log as any).source || 'manual',
  }));

  // Fetch the latest irrigation event
const latestIrrigation = await db.irrigationEvent.findFirst({
  orderBy: { timestamp: "desc" },
});

return {
  environmentReadings,
  dryBackLogs,
  latestIrrigation: latestIrrigation ? {
    moisturePercent: Number(latestIrrigation.moisturePercentage),
    ec: latestIrrigation.ecLevel ? Number(latestIrrigation.ecLevel) : null,
    timestamp: latestIrrigation.timestamp.toISOString(),
  } : null,
};
}

export async function addManualClimateAndWeight(data: {
  temperature: number; 
  humidity: number;
  weight?: number; 
  notes?: string;
  plantId?: string;
  wetWeight?: number; 
  dryTarget?: number; 
  batchId?: string;
}) {
  const userId = await getUserId();

    // If batchId is provided, get the batch targets
let wet: number | undefined = data.wetWeight;
let dryTarget: number | undefined = data.dryTarget;

if (data.plantId) {
  const plant = await db.plant.findUnique({
    where: { id: data.plantId },
    select: { wetWeight: true, dryTarget: true },
  });
  if (plant) {
    wet = data.wetWeight ?? (plant.wetWeight !== null ? Number(plant.wetWeight) : undefined);
    dryTarget = data.dryTarget ?? (plant.dryTarget !== null ? Number(plant.dryTarget) : undefined);
  }
}

if (data.batchId && (wet === undefined || dryTarget === undefined)) {
  const batch = await db.batch.findUnique({
    where: { id: data.batchId },
    select: { wetWeight: true, dryTarget: true },
  });
  if (batch) {
    wet = wet ?? (batch.wetWeight !== null ? Number(batch.wetWeight) : undefined);
    dryTarget = dryTarget ?? (batch.dryTarget !== null ? Number(batch.dryTarget) : undefined);
  }
}

wet = wet ?? 18.4;
dryTarget = dryTarget ?? 13.2;

  // Insert climate log
  const climateResult = await db.climateLog.create({
    data: {
      airTempC: data.temperature,
      relativeHumidity: data.humidity,
      timestamp: new Date(),
      isManualEntry: true,
      roomId: 'Manual Entry',
      zoneId: 'Manual',
      leafOffsetC: 2.0,
      userId: userId,
    },
  });

  // If weight provided, insert dry‑back log
  let dryBackResult = null;
  if (data.weight !== undefined && data.weight !== null) {
    const wet = data.wetWeight ?? 18.4;
    const dryTarget = data.dryTarget ?? 13.2;
    const dryBackPercent = Math.max(0, Math.min(100, ((wet - data.weight) / (wet - dryTarget)) * 100));
    dryBackResult = await db.dryBackLog.create({
      data: {
        timestamp: new Date(),
        batchId: data.batchId || null,
        containerGallons: 5, // default
        wetWeightLbs: wet,
        dryTargetWeightLbs: dryTarget,
        currentWeightLbs: data.weight,
        dryBackPercent: dryBackPercent,
        runoffEc: null,
        notes: data.notes || null,
        unit: 'lbs',
        userId: userId,
      },
    });
  }

  revalidatePath('/');
  return {
    success: true,
    climateId: climateResult.id,
    dryBackId: dryBackResult?.id,
  };
}

export async function addManualClimateLog(data: {
  temperature: number;
  humidity: number;
  timestamp?: Date;
}) {
  const userId = await getUserId();

  const result = await db.climateLog.create({
    data: {
      airTempC: data.temperature,
      relativeHumidity: data.humidity,
      timestamp: data.timestamp || new Date(),
      isManualEntry: true,
      roomId: "Manual Entry",
      zoneId: "Manual",
      leafOffsetC: 2.0,
      userId: userId,

    },
  });

  revalidatePath("/");
  return { success: true, id: result.id };
}

// --- BATCH MANAGEMENT ---
export async function getBatches() {
  const userId = await getUserId();

  return await db.batch.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    include: { dryBackLogs: true },
  });
}

export async function createBatch(data: { name: string; cultivar: string; roomId: string; wetWeight?: number; dryTarget?: number }) {
  const userId = await getUserId();
  const batch = await db.batch.create({
    data: {
      name: data.name,
      cultivar: data.cultivar,
      roomId: data.roomId,
      userId: userId,
      wetWeight: data.wetWeight || null,
      dryTarget: data.dryTarget || null,
    },
  });
  revalidatePath('/');
  return batch;
}

export async function getBatch(batchId: string) {
  const userId = await getUserId();

  return await db.batch.findUnique({
    where: { id: batchId, userId },
    include: {
      dryBackLogs: {
        where: { userId },
        orderBy: { timestamp: 'asc' },
      },
    },
  });
}

export async function exportAllBatches() {
  const userId = await getUserId();
  return await db.batch.findMany({
    where: { userId },
    include: {
      dryBackLogs: {
      where: { userId },
    },
  },
    orderBy: { startDate: 'desc' },
  });
}

export async function getBatchesForComparison(batchIds: string[]) {
  const userId = await getUserId();
  return await db.batch.findMany({
    where: {
      userId,
      id: { in: batchIds },
    },
    include: {
      dryBackLogs: {
        where: { userId },
        orderBy: { timestamp: 'asc' },
      },
    },
  });
}

export async function setActiveBatch(batchId: string) {
  // We'll store the active batch ID in a system setting later, but for now we'll just use a cookie or a global state.
  // Simpler: we'll store it in the user's profile (add a field to UserProfile later).
  // We'll just return it for now and handle frontend state.
  // We'll implement a simple store in a future story.
}

export async function addDryBackLog(data: {
  cultivar: string;
  containerGallons: number;
  wetWeight: number;
  dryTarget: number;
  weight: number;
  runoff_ec: number;
  unit: string;
  batchId?: string;
  plantId?: string;
}) {
  const userId = await getUserId();
  const dryBackPercent = ((data.wetWeight - data.weight) / (data.wetWeight - data.dryTarget)) * 100;
  const clampedPercent = Math.max(0, Math.min(100, dryBackPercent));

  const result = await db.dryBackLog.create({
    data: {
    containerGallons: data.containerGallons,
    wetWeightLbs: data.wetWeight,
    dryTargetWeightLbs: data.dryTarget, 
    currentWeightLbs: data.weight,
    dryBackPercent: clampedPercent,
    runoffEc: data.runoff_ec || null,
    notes: `Cultivar: ${data.cultivar}`,
    timestamp: new Date(),
    batchId: data.batchId || null,
    plantId: data.plantId || null,
    userId: userId,
    unit: data.unit || 'lbs',
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

// --- DAILY AI BRIEFING ---

export async function generateDailyBriefing() {
  try {
    const userId = await getUserId();

    // Fetch latest data
    const [climateLogs, dryBackLogs, irrigationEvent] = await Promise.all([
      db.climateLog.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
        take: 24, // last 24 hours
      }),
      db.dryBackLog.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
        take: 5, // last 5 logs for trend
      }),
      db.irrigationEvent.findFirst({
        where: { userId },
        orderBy: { timestamp: "desc" },
      }),
    ]);

    // Prepare data for AI
    const latestEnv = climateLogs[0];
    const avgVpd = climateLogs.length > 0
      ? climateLogs.reduce((sum, l) => sum + Number(l.calculatedVpdKpa || computeVPD(Number(l.airTempC), Number(l.relativeHumidity))), 0) / climateLogs.length
      : 0;

    const dryBackTrend = dryBackLogs.length > 1
      ? (Number(dryBackLogs[0].dryBackPercent) - Number(dryBackLogs[1].dryBackPercent)) > 5 ? "increasing" : "stable"
      : "stable";

    const moisture = irrigationEvent ? Number(irrigationEvent.moisturePercentage) : null;
    const ec = irrigationEvent?.ecLevel ? Number(irrigationEvent.ecLevel) : null;

    // Build prompt
    const prompt = `
You are a cultivation assistant. Provide a brief, actionable summary (2-3 sentences) based on the following data:

- Latest VPD: ${latestEnv ? Number(latestEnv.calculatedVpdKpa || computeVPD(Number(latestEnv.airTempC), Number(latestEnv.relativeHumidity))).toFixed(2) : 'N/A'}
- Average VPD over last 24h: ${avgVpd.toFixed(2)}
- Latest Temperature: ${latestEnv ? Number(latestEnv.airTempC).toFixed(1) : 'N/A'}°C (${latestEnv ? (Number(latestEnv.airTempC)*9/5+32).toFixed(1) : 'N/A'}°F)
- Latest Humidity: ${latestEnv ? Number(latestEnv.relativeHumidity).toFixed(0) : 'N/A'}%
- Dry-back trend: ${dryBackTrend} (latest: ${dryBackLogs.length > 0 ? Number(dryBackLogs[0].dryBackPercent).toFixed(0) : 'N/A'}%)
- Root moisture: ${moisture !== null ? moisture.toFixed(0) : 'N/A'}%
- EC: ${ec !== null ? ec.toFixed(2) : 'N/A'}

Based on this, give ONE clear recommendation (e.g., "Increase humidity", "Irrigate today", "Check EC", "Monitor closely") and a brief explanation. Keep it concise and actionable.
`;

    // Call AI
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text || "No response generated.";

    return { success: true, summary: text };
  } catch (error) {
    console.error("AI briefing error:", error);
    return { success: false, error: "Failed to generate briefing" };
  }
}

export async function updateBatchTargets(data: {
  batchId: string;
  wetWeight?: number | null;
  dryTarget?: number | null;
}) {
  const userId = await getUserId();
  const batch = await db.batch.update({
    where: { id: data.batchId, userId },
    data: {
      wetWeight: data.wetWeight !== undefined && data.wetWeight !== null ? data.wetWeight : undefined,
      dryTarget: data.dryTarget !== undefined && data.dryTarget !== null ? data.dryTarget : undefined,
    },
  });
  revalidatePath('/');
  return { success: true, batch };
}

// --- PLANT MANAGEMENT ---
export async function getPlantsForBatch(batchId: string) {
  const userId = await getUserId();
  return await db.plant.findMany({
    where: { batchId, userId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createPlant(data: {
  batchId: string;
  name: string;
  wetWeight?: number;
  dryTarget?: number;
}) {
  const userId = await getUserId();
  const plant = await db.plant.create({
    data: {
      name: data.name,
      batchId: data.batchId,
      userId,
      wetWeight: data.wetWeight || null,
      dryTarget: data.dryTarget || null,
    },
  });
  revalidatePath('/');
  return plant;
}

export async function updatePlant(data: {
  id: string;
  name?: string;
  wetWeight?: number | null;
  dryTarget?: number | null;
  currentWeight?: number | null;
}) {
  const userId = await getUserId();
  const plant = await db.plant.update({
    where: { id: data.id, userId },
    data: {
      name: data.name,
      wetWeight: data.wetWeight !== undefined ? data.wetWeight : undefined,
      dryTarget: data.dryTarget !== undefined ? data.dryTarget : undefined,
      currentWeight: data.currentWeight !== undefined ? data.currentWeight : undefined,
    },
  });
  revalidatePath('/');
  return plant;
}

export async function logIrrigation(data: {
  batchId?: string;
  plantId?: string;
  weight: number;
  notes?: string;
}) {
  const userId = await getUserId();

  // Determine targets (from plant, then batch, then defaults)
  let wetWeight: number | undefined;
  let dryTarget: number | undefined;

  if (data.plantId) {
    const plant = await db.plant.findUnique({
      where: { id: data.plantId, userId },
      select: { wetWeight: true, dryTarget: true },
    });
    if (plant) {
      wetWeight = plant.wetWeight !== null ? Number(plant.wetWeight) : undefined;
      dryTarget = plant.dryTarget !== null ? Number(plant.dryTarget) : undefined;
    }
  }

  if (data.batchId && (wetWeight === undefined || dryTarget === undefined)) {
    const batch = await db.batch.findUnique({
      where: { id: data.batchId, userId },
      select: { wetWeight: true, dryTarget: true },
    });
    if (batch) {
      wetWeight = wetWeight ?? (batch.wetWeight !== null ? Number(batch.wetWeight) : undefined);
      dryTarget = dryTarget ?? (batch.dryTarget !== null ? Number(batch.dryTarget) : undefined);
    }
  }

  wetWeight = wetWeight ?? 18.4;
  dryTarget = dryTarget ?? 13.2;

  // Compute dry-back percent
  const dryBackPercent = Math.max(0, Math.min(100, ((wetWeight - data.weight) / (wetWeight - dryTarget)) * 100));

  // 1. Insert dry-back log
  const dryBackLog = await db.dryBackLog.create({
    data: {
      timestamp: new Date(),
      batchId: data.batchId || null,
      plantId: data.plantId || null,
      containerGallons: 5, // can be configurable later
      wetWeightLbs: wetWeight,
      dryTargetWeightLbs: dryTarget,
      currentWeightLbs: data.weight,
      dryBackPercent: dryBackPercent,
      runoffEc: null,
      notes: data.notes || `Irrigation logged (weight: ${data.weight} lbs)`,
      unit: 'lbs',
      userId: userId,
      source: 'manual',
    },
  });

  // 2. Insert irrigation event
  const irrigation = await db.irrigationEvent.create({
    data: {
      timestamp: new Date(),
      roomId: 'Manual',
      zoneId: 'Main',
      moisturePercentage: dryBackPercent, // or we can store weight? but we have a separate field
      isManualEntry: true,
      userId: userId,
      batchId: data.batchId || null,
      plantId: data.plantId || null,
      // If you added currentWeightLbs, you can set it:
      // currentWeightLbs: data.weight,
    },
  });

  revalidatePath('/');
  revalidatePath('/weights');

  return {
    success: true,
    dryBackId: dryBackLog.id,
    irrigationId: irrigation.id,
  };
}