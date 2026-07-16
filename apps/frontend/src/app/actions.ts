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
    source: log.source || 'manual',
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
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
  try {
    // Validate batch exists and belongs to user
    const batch = await db.batch.findUnique({
      where: { id: data.batchId, userId },
      select: { id: true },
    });
    if (!batch) {
      throw new Error('Batch not found or unauthorized');
    }

    const plant = await db.plant.create({
      data: {
        name: data.name,
        batchId: data.batchId,
        userId,
        wetWeight: data.wetWeight ?? null,
        dryTarget: data.dryTarget ?? null,
      },
    });
    revalidatePath('/');
    return plant;
  } catch (error) {
    console.error('createPlant error:', error);
    throw error;
  }
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

export async function getWaterUseData(batchId?: string, plantId?: string) {
  const userId = await getUserId();
  const logs = await db.dryBackLog.findMany({
    where: {
      userId,
      ...(batchId ? { batchId } : {}),
      ...(plantId ? { plantId } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 48, // last 48 entries (assuming 1 per day)
  });

  if (logs.length < 2) return null;

  // Sort ascending
  const sorted = logs.reverse();
  const now = new Date();
  const last24h = sorted.filter(log => (now.getTime() - new Date(log.timestamp).getTime()) < 24 * 60 * 60 * 1000);

  if (last24h.length < 2) return null;

  const first = last24h[0];
  const last = last24h[last24h.length - 1];
  const hoursDiff = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursDiff < 1) return null;

  const weightDiff = Number(first.currentWeightLbs) - Number(last.currentWeightLbs);
  const dailyWaterUse = (weightDiff / hoursDiff) * 24;

  // Project next irrigation
  const avgDryBackPerDay = dailyWaterUse / 24; // lbs per hour
  const remainingToDryTarget = Number(first.currentWeightLbs) - Number(first.dryTargetWeightLbs);
  const hoursUntilIrrigation = remainingToDryTarget / avgDryBackPerDay;

  return {
    dailyWaterUse: Math.round(dailyWaterUse * 10) / 10,
    hoursUntilIrrigation,
    currentWeight: Number(first.currentWeightLbs),
    dryTarget: Number(first.dryTargetWeightLbs),
  };
}
export async function getTrendInsights(batchId?: string, plantId?: string) {
  const userId = await getUserId();

  // Fetch last 30 dry-back logs (ordered by timestamp descending)
  const logs = await db.dryBackLog.findMany({
    where: {
      userId,
      ...(batchId ? { batchId } : {}),
      ...(plantId ? { plantId } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 30,
  });

  if (logs.length < 6) {
    return { drybackSpeed: null, uptakeTrend: null };
  }

  // Sort ascending (oldest first)
  const sorted = [...logs].reverse();

  // Take last 5 for recent average, and the 5 before that for historical average
  const recent = sorted.slice(-5);
  const historical = sorted.slice(-10, -5);

  // Calculate average daily weight change (lbs per day)
  // For each segment, compute total weight change over the period
  const calcDailyRate = (segment: any[]) => {
    if (segment.length < 2) return 0;
    const first = segment[0];
    const last = segment[segment.length - 1];
    const hours = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return 0;
    const weightDiff = Number(first.currentWeightLbs) - Number(last.currentWeightLbs);
    return (weightDiff / hours) * 24; // lbs per day
  };

  const recentRate = calcDailyRate(recent);
  const historicalRate = calcDailyRate(historical);

  // Dryback speed insight
  let drybackSpeed = null;
  if (recentRate > 0 && historicalRate > 0) {
    const pctChange = ((recentRate - historicalRate) / historicalRate) * 100;
    drybackSpeed = {
      pct: Math.round(pctChange),
      direction: pctChange > 5 ? 'faster' : pctChange < -5 ? 'slower' : 'stable',
    };
  }

  // Uptake trend (daily water use – compare recent to historical)
  let uptakeTrend = null;
  if (recentRate > 0 && historicalRate > 0) {
    const pctChange = ((recentRate - historicalRate) / historicalRate) * 100;
    uptakeTrend = {
      pct: Math.round(pctChange),
      direction: pctChange > 10 ? 'increasing' : pctChange < -10 ? 'decreasing' : 'stable',
    };
  }

  return { drybackSpeed, uptakeTrend };
}

export async function getRecoveryStatus(batchId?: string, plantId?: string) {
  const userId = await getUserId();

  // Fetch last 14 days of dry-back logs
  const logs = await db.dryBackLog.findMany({
    where: {
      userId,
      ...(batchId ? { batchId } : {}),
      ...(plantId ? { plantId } : {}),
      timestamp: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { timestamp: "asc" },
  });

  if (logs.length < 3) {
    return {
      phase: 0,
      status: 'Insufficient data',
      recommendation: 'Log more dry-back readings to track recovery.',
    };
  }

  // Extract weights and dates
  const weights = logs.map(l => Number(l.currentWeightLbs));
  const timestamps = logs.map(l => new Date(l.timestamp));

  // Detect trends: is weight decreasing, increasing, or stable?
  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = last - first;
  const percentChange = (change / first) * 100;

  // Simple trend detection
  let phase = 0;
  let status = '';
  let recommendation = '';

  if (percentChange < -15) {
    // Significant weight drop – drought stress or active dryback
    phase = 1;
    status = '🔴 Drought stress detected';
    recommendation = 'Increase irrigation frequency. Monitor for recovery in 24h.';
  } else if (percentChange > 5 && logs.length > 5) {
    // Weight increasing – potential overwatering or recovery
    const recentTrend = weights.slice(-3);
    if (recentTrend.every((w, i) => i === 0 || w >= recentTrend[i-1])) {
      phase = 2;
      status = '⚠️ Overwatering risk';
      recommendation = 'Reduce irrigation volume. Allow longer dryback between feeds.';
    } else {
      phase = 3;
      status = '📈 Recovery phase';
      recommendation = 'Continue current irrigation plan. Monitor daily uptake.';
    }
  } else if (percentChange > -5 && percentChange < 5) {
    // Stable weight – likely normal growth or maintenance
    phase = 4;
    status = '✅ Stable growth';
    recommendation = 'Maintain current irrigation plan.';
  } else {
    // Slow dryback – possibly mild stress
    phase = 5;
    status = '🔄 Moderate dryback';
    recommendation = 'Continue monitoring. Adjust irrigation if weight drops below target.';
  }

  return { phase, status, recommendation };
}

export async function getDiagnostics(batchId?: string, plantId?: string) {
  const userId = await getUserId();

  // Fetch latest data
  const [logs, env, irrigation] = await Promise.all([
    db.dryBackLog.findMany({
      where: {
        userId,
        ...(batchId ? { batchId } : {}),
        ...(plantId ? { plantId } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
    db.climateLog.findFirst({
      where: { userId },
      orderBy: { timestamp: "desc" },
    }),
    db.irrigationEvent.findFirst({
      where: { userId },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  if (logs.length < 5 || !env) {
    return { error: "Insufficient data for diagnostics" };
  }

  const latestLog = logs[0];
  const weight = Number(latestLog.currentWeightLbs);
  const dryback = Number(latestLog.dryBackPercent);
  const wetTarget = Number(latestLog.wetWeightLbs);
  const dryTarget = Number(latestLog.dryTargetWeightLbs);
  const vpd = env.calculatedVpdKpa ? Number(env.calculatedVpdKpa) : computeVPD(Number(env.airTempC), Number(env.relativeHumidity));
  const moisture = irrigation ? Number(irrigation.moisturePercentage) : null;
  const ec = irrigation?.ecLevel ? Number(irrigation.ecLevel) : null;

  // --- Scoring logic ---

  // 1. Overwatering score
  let overwaterScore = 0;
  if (weight > wetTarget * 0.95) {
    overwaterScore += 40;
  }
  if (dryback < 20) {
    overwaterScore += 30;
  }
  if (moisture !== null && moisture > 80) {
    overwaterScore += 30;
  }
  overwaterScore = Math.min(100, overwaterScore);

  // 2. Drought stress
  let droughtScore = 0;
  if (dryback > 80) {
    droughtScore += 50;
  }
  if (weight < dryTarget * 0.9) {
    droughtScore += 30;
  }
  if (moisture !== null && moisture < 40) {
    droughtScore += 20;
  }
  droughtScore = Math.min(100, droughtScore);

  // 3. Nutrient deficiency (simple EC-based)
  let nutrientScore = 0;
  if (ec !== null) {
    if (ec < 0.8) {
      nutrientScore += 70;
    } else if (ec < 1.2) {
      nutrientScore += 30;
    }
  } else {
    nutrientScore = 0; // unknown
  }

  // 4. Light stress (VPD high + low moisture)
  let lightStressScore = 0;
  if (vpd > 1.5) {
    lightStressScore += 50;
  }
  if (moisture !== null && moisture < 50) {
    lightStressScore += 30;
  }
  if (dryback > 70) {
    lightStressScore += 20;
  }
  lightStressScore = Math.min(100, lightStressScore);

  // Normalize scores to sum to 100
  const total = overwaterScore + droughtScore + nutrientScore + lightStressScore;
  if (total === 0) {
    return {
      overwater: 0,
      drought: 0,
      nutrient: 0,
      lightStress: 0,
      recommendation: "All systems optimal.",
    };
  }

  // Weighted scores (percentage of total)
  const normalize = (score: number) => Math.round((score / total) * 100);

  return {
    overwater: normalize(overwaterScore),
    drought: normalize(droughtScore),
    nutrient: normalize(nutrientScore),
    lightStress: normalize(lightStressScore),
    recommendation: getDiagnosticRecommendation(overwaterScore, droughtScore, nutrientScore, lightStressScore),
  };
}

function getDiagnosticRecommendation(overwater: number, drought: number, nutrient: number, light: number): string {
  const max = Math.max(overwater, drought, nutrient, light);
  if (max === 0) return "All systems optimal.";
  if (max === overwater) return "Reduce irrigation frequency. Allow more dryback.";
  if (max === drought) return "Increase irrigation. Monitor moisture levels.";
  if (max === nutrient) return "Check EC. Adjust nutrient strength.";
  if (max === light) return "Reduce light intensity or increase humidity.";
  return "Monitor closely.";
}