// src/app/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getRequiredUserId } from "@/lib/session";

// Helper: compute VPD (kPa) from temp (°C) and RH (%)
function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  const vpd = es - ea;
  return Math.round(vpd * 100) / 100; // 2 decimal places
}

/**
 * FETCH DASHBOARD DATA (using current schema)
 */
export async function getDashboardData() {
  // In local dev, getRequiredUserId returns 'local-dev-user' – we ignore it.
  const userId = await getRequiredUserId();

  // 1. Fetch latest 30 climate logs (ordered by timestamp descending)
  const climateLogs = await db.climateLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 30,
  });

  // Build dry‑back logs from climate logs (simulated from humidity)
  const dryBackLogs = climateLogs.map((log) => {
    const dryBackPercent = Math.min(100, Math.max(0, 100 - Number(log.relativeHumidity)));
    return {
      id: log.id,
      stage: log.zoneId || "Main",
      containerGallons: 5,
      wetWeight: 18.4,
      dryTargetWeight: 13.2,
      weight: dryBackPercent,
      dryBackPercent: dryBackPercent,
      runoff_ec: 0,
      loggedAt: log.timestamp.toISOString(),
    };
  });

  // Build environment readings from climate logs (all plain numbers / strings)
  const environmentReadings = climateLogs.map((log) => ({
    id: log.id,
    temperatureF: Number(log.airTempC) * 9 / 5 + 32,
    temperature: Number(log.airTempC),
    humidity: Number(log.relativeHumidity),
    vpd: log.calculatedVpdKpa ? Number(log.calculatedVpdKpa) : computeVPD(Number(log.airTempC), Number(log.relativeHumidity)),
    runoff_ec: 0,
    dry_back: 0,
    recordedAt: log.timestamp.toISOString(),
  }));

  // Return ONLY plain serializable data
  return {
    environmentReadings,
    dryBackLogs,
  };
}

/**
 * STUBBED FUNCTIONS (not used on main dashboard)
 * We keep them to avoid import errors, but they return empty data.
 */
export async function addDryBackLog(data: any) {
  console.warn("addDryBackLog is stubbed - no action taken.");
  return { success: false, error: "Not implemented" };
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
  return { success: false, error: "Not implemented" };
}

export async function deleteCustomBlueprint(id: string) {
  return { success: false, error: "Not implemented" };
}