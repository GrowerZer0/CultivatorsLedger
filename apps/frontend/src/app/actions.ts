// src/app/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from '@prisma/client';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';

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

export async function getDashboardData(batchId?: string) {
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
    },
    orderBy: { timestamp: "asc" },
    take: 30,
  });

  // Map to the DryBackLog type expected by the frontend
  const dryBackLogs = dryBackLogsFromDb.map((log: PrismaDryBackLog) => ({
    id: String(log.id),
    cultivar: "Batch", // later link to batch
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

export async function addManualClimateAndWeight(data: {
  temperature: number; 
  humidity: number;
  weight?: number; 
  notes?: string;
  wetWeight?: number; 
  dryTargetWeight?: number; 
  batchId?: string;
}) {
  const userId = await getUserId();

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
    const dryTarget = data.dryTargetWeight ?? 13.2;
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
  });
}

export async function createBatch(data: { name: string; cultivar: string; roomId: string }) {
  const userId = await getUserId();
  const batch = await db.batch.create({
    data: {
      name: data.name,
      cultivar: data.cultivar,
      roomId: data.roomId,
      userId: userId,
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
  dryTargetWeight: number;
  weight: number;
  runoff_ec: number;
  unit: string;
  batchId?: string;
}) {
  const userId = await getUserId();
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
      batchId: data.batchId || null,
      userId: userId,
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