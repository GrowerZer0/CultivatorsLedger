"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

// Helper to hash API keys
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Generate a new API key (32 hex chars)
function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}

// ==========================================
// SENSOR CONFIG CRUD
// ==========================================

export async function getSensors() {
  const userId = await getUserId();
  return await db.sensorConfig.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
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
  return { ...sensor, apiKey };
}

export async function toggleSensor(sensorId: string, isActive: boolean) {
  const userId = await getUserId();
  const existing = await db.sensorConfig.findFirst({
    where: { id: sensorId, userId },
  });
  if (!existing) throw new Error("Sensor not found or unauthorized");
  return await db.sensorConfig.update({
    where: { id: sensorId },
    data: { isActive },
  });
}

export async function deleteSensor(sensorId: string) {
  const userId = await getUserId();
  const existing = await db.sensorConfig.findFirst({
    where: { id: sensorId, userId },
  });
  if (!existing) throw new Error("Sensor not found or unauthorized");
  return await db.sensorConfig.delete({ where: { id: sensorId } });
}

export async function regenerateApiKey(sensorId: string) {
  const userId = await getUserId();
  const existing = await db.sensorConfig.findFirst({
    where: { id: sensorId, userId },
  });
  if (!existing) throw new Error("Sensor not found or unauthorized");
  const newKey = generateApiKey();
  const newHash = hashKey(newKey);
  const updated = await db.sensorConfig.update({
    where: { id: sensorId },
    data: { apiKeyHash: newHash },
  });
  return { ...updated, apiKey: newKey };
}