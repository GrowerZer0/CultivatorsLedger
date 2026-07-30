"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from "@prisma/client";
// Helper: compute VPD (kPa) from temp (°C) and RH (%)
function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  const vpd = es - ea;
  return Math.round(vpd * 100) / 100;
}
// ==========================================
// LOGGING & DASHBOARD READINGS
// ==========================================
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
      unit: data.unit || "lbs",
    },
  });
  revalidatePath("/");
  return { success: true, id: result.id };
}
export async function logIrrigation(data: {
  batchId?: string;
  plantId?: string;
  weight: number;
  notes?: string;
}) {
  const userId = await getUserId();
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
  const dryBackPercent = Math.max(
    0,
    Math.min(100, ((wetWeight - data.weight) / (wetWeight - dryTarget)) * 100)
  );
  const dryBackLog = await db.dryBackLog.create({
    data: {
      timestamp: new Date(),
      batchId: data.batchId || null,
      plantId: data.plantId || null,
      containerGallons: 5,
      wetWeightLbs: wetWeight,
      dryTargetWeightLbs: dryTarget,
      currentWeightLbs: data.weight,
      dryBackPercent: dryBackPercent,
      runoffEc: null,
      notes: data.notes || `Irrigation logged (weight: ${data.weight} lbs)`,
      unit: "lbs",
      userId: userId,
      source: "manual",
    },
  });
  const irrigation = await db.irrigationEvent.create({
    data: {
      timestamp: new Date(),
      roomId: "Manual",
      zoneId: "Main",
      moisturePercentage: dryBackPercent,
      isManualEntry: true,
      userId: userId,
      batchId: data.batchId || null,
      plantId: data.plantId || null,
    },
  });
  revalidatePath("/");
  return {
    success: true,
    dryBackId: dryBackLog.id,
    irrigationId: irrigation.id,
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
  const climateResult = await db.climateLog.create({
    data: {
      airTempC: data.temperature,
      relativeHumidity: data.humidity,
      timestamp: new Date(),
      isManualEntry: true,
      roomId: "Manual Entry",
      zoneId: "Manual",
      leafOffsetC: 2.0,
      userId: userId,
    },
  });
  let dryBackResult = null;
  if (data.weight !== undefined && data.weight !== null) {
    const dryBackPercent = Math.max(
      0,
      Math.min(100, ((wet - data.weight) / (wet - dryTarget)) * 100)
    );
    dryBackResult = await db.dryBackLog.create({
      data: {
        timestamp: new Date(),
        batchId: data.batchId || null,
        plantId: data.plantId || null,
        containerGallons: 5,
        wetWeightLbs: wet,
        dryTargetWeightLbs: dryTarget,
        currentWeightLbs: data.weight,
        dryBackPercent: dryBackPercent,
        runoffEc: null,
        notes: data.notes || null,
        unit: "lbs",
        userId: userId,
      },
    });
  }
  revalidatePath("/");
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
export async function getDashboardData(batchId?: string, plantId?: string) {
  const userId = await getUserId();
  const climateLogs = await db.climateLog.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    take: 30,
  });
  const sortedLogs = [...climateLogs].reverse();
  const environmentReadings = sortedLogs.map((log) => ({
    id: String(log.id),
    temperatureF: (Number(log.airTempC) * 9) / 5 + 32,
    temperature: Number(log.airTempC),
    humidity: Number(log.relativeHumidity),
    vpd: log.calculatedVpdKpa
      ? Number(log.calculatedVpdKpa)
      : computeVPD(Number(log.airTempC), Number(log.relativeHumidity)),
    runoff_ec: 0,
    dry_back: 0,
    recordedAt: log.timestamp.toISOString(),
  }));
  const dryBackLogsFromDb = await db.dryBackLog.findMany({
    where: {
      userId,
      ...(batchId ? { batchId } : {}),
      ...(plantId ? { plantId } : {}),
    },
    orderBy: { timestamp: "asc" },
    take: 30,
  });
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
    source: log.source || "manual",
  }));
  const latestIrrigation = await db.irrigationEvent.findFirst({
    where: { userId },
    orderBy: { timestamp: "desc" },
  });
  return {
    environmentReadings,
    dryBackLogs,
    latestIrrigation: latestIrrigation
      ? {
          moisturePercent: Number(latestIrrigation.moisturePercentage),
          ec: latestIrrigation.ecLevel ? Number(latestIrrigation.ecLevel) : null,
          timestamp: latestIrrigation.timestamp.toISOString(),
        }
      : null,
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
    take: 48,
  });
  if (logs.length < 2) return null;
  const sorted = logs.reverse();
  const now = new Date();
  const last24h = sorted.filter(
    (log) => now.getTime() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000
  );
  if (last24h.length < 2) return null;
  const first = last24h[0];
  const last = last24h[last24h.length - 1];
  const hoursDiff =
    (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursDiff < 1) return null;
  const weightDiff = Number(first.currentWeightLbs) - Number(last.currentWeightLbs);
  const dailyWaterUse = (weightDiff / hoursDiff) * 24;
  const avgDryBackPerDay = dailyWaterUse / 24;
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
  const sorted = [...logs].reverse();
  const recent = sorted.slice(-5);
  const historical = sorted.slice(-10, -5);
  const calcDailyRate = (segment: any[]) => {
    if (segment.length < 2) return 0;
    const first = segment[0];
    const last = segment[segment.length - 1];
    const hours =
      (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) /
      (1000 * 60 * 60);
    if (hours < 1) return 0;
    const weightDiff = Number(first.currentWeightLbs) - Number(last.currentWeightLbs);
    return (weightDiff / hours) * 24;
  };
  const recentRate = calcDailyRate(recent);
  const historicalRate = calcDailyRate(historical);
  let drybackSpeed = null;
  if (recentRate > 0 && historicalRate > 0) {
    const pctChange = ((recentRate - historicalRate) / historicalRate) * 100;
    drybackSpeed = {
      pct: Math.round(pctChange),
      direction: pctChange > 5 ? "faster" : pctChange < -5 ? "slower" : "stable",
    };
  }
  let uptakeTrend = null;
  if (recentRate > 0 && historicalRate > 0) {
    const pctChange = ((recentRate - historicalRate) / historicalRate) * 100;
    uptakeTrend = {
      pct: Math.round(pctChange),
      direction: pctChange > 10 ? "increasing" : pctChange < -10 ? "decreasing" : "stable",
    };
  }
  return { drybackSpeed, uptakeTrend };
}
export async function getRecoveryStatus(batchId?: string, plantId?: string) {
  const userId = await getUserId();
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
      status: "Insufficient data",
      recommendation: "Log more dry-back readings to track recovery.",
    };
  }
  const weights = logs.map((l) => Number(l.currentWeightLbs));
  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = last - first;
  const percentChange = (change / first) * 100;
  let phase = 0;
  let status = "";
  let recommendation = "";
  if (percentChange < -15) {
    phase = 1;
    status = "🔴 Drought stress detected";
    recommendation = "Increase irrigation frequency. Monitor for recovery in 24h.";
  } else if (percentChange > 5 && logs.length > 5) {
    const recentTrend = weights.slice(-3);
    if (recentTrend.every((w, i) => i === 0 || w >= recentTrend[i - 1])) {
      phase = 2;
      status = "⚠️ Overwatering risk";
      recommendation = "Reduce irrigation volume. Allow longer dryback between feeds.";
    } else {
      phase = 3;
      status = "📈 Recovering";
      recommendation = "Plant dryback is within expected target range.";
    }
  } else {
    phase = 3;
    status = "🟢 Optimal dryback";
    recommendation = "Maintain current irrigation schedule.";
  }
  return { phase, status, recommendation };
}
export async function getDiagnostics(batchId?: string, plantId?: string) {
  const userId = await getUserId();
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
  const vpd = env.calculatedVpdKpa
    ? Number(env.calculatedVpdKpa)
    : computeVPD(Number(env.airTempC), Number(env.relativeHumidity));
  const moisture = irrigation ? Number(irrigation.moisturePercentage) : null;
  const ec = irrigation?.ecLevel ? Number(irrigation.ecLevel) : null;
  let overwaterScore = 0;
  if (weight > wetTarget * 0.95) overwaterScore += 40;
  if (dryback < 20) overwaterScore += 30;
  if (moisture !== null && moisture > 80) overwaterScore += 30;
  overwaterScore = Math.min(100, overwaterScore);
  let droughtScore = 0;
  if (dryback > 80) droughtScore += 50;
  if (weight < dryTarget * 0.9) droughtScore += 30;
  if (moisture !== null && moisture < 40) droughtScore += 20;
  droughtScore = Math.min(100, droughtScore);
  let nutrientScore = 0;
  if (ec !== null) {
    if (ec < 0.8) nutrientScore += 70;
    else if (ec < 1.2) nutrientScore += 30;
  }
  let lightStressScore = 0;
  if (vpd > 1.5) lightStressScore += 50;
  if (moisture !== null && moisture < 50) lightStressScore += 30;
  if (dryback > 70) lightStressScore += 20;
  lightStressScore = Math.min(100, lightStressScore);
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
  const normalize = (score: number) => Math.round((score / total) * 100);
  return {
    overwater: normalize(overwaterScore),
    drought: normalize(droughtScore),
    nutrient: normalize(nutrientScore),
    lightStress: normalize(lightStressScore),
  };
}