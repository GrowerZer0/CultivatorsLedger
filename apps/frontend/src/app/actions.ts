"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

// ==========================================
// HELPERS & CACHE GLOBALS
// ==========================================

// In-memory cache to prevent infinite render loops from exhausting Gemini API quota
let cachedBriefingResponse: { summary: string; timestamp: number } | null = null;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Helper: compute VPD (kPa) from temp (°C) and RH (%)
function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  const vpd = es - ea;
  return Math.round(vpd * 100) / 100;
}

// Helper to hash API keys
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Generate a new API key (32 hex chars)
function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}





// Placeholders for profiles and blueprints
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

