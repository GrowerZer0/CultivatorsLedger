"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import type { DryBackLog as PrismaDryBackLog } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

// ==========================================
// HELPERS
// ==========================================

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

// ==========================================
// FACILITY MANAGEMENT (ROOMS / TENTS)
// ==========================================

export async function getRooms() {
  const userId = await getUserId();
  return await db.room.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRoom(data: { name: string; type?: string }) {
  try {
    const userId = await getUserId();
    const room = await db.room.create({
      data: {
        name: data.name,
        type: data.type || "tent",
        userId,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true, room };
  } catch (error) {
    console.error("Failed to create room:", error);
    return { success: false, error: "Failed to create room." };
  }
}

export async function updateRoom(
  roomId: string,
  data: { name?: string; type?: string }
) {
  try {
    const userId = await getUserId();
    const room = await db.room.update({
      where: { id: roomId, userId },
      data,
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true, room };
  } catch (error) {
    console.error("Failed to update room:", error);
    return { success: false, error: "Failed to update room." };
  }
}

export async function deleteRoom(roomId: string) {
  try {
    const userId = await getUserId();
    await db.room.delete({
      where: { id: roomId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete room:", error);
    return { success: false, error: "Failed to delete room." };
  }
}

// ==========================================
// BATCH MANAGEMENT
// ==========================================

export async function getBatches() {
  const userId = await getUserId();

  return await db.batch.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    include: { dryBackLogs: true },
  });
}

export async function getBatch(batchId: string) {
  const userId = await getUserId();

  return await db.batch.findUnique({
    where: { id: batchId, userId },
    include: {
      dryBackLogs: {
        where: { userId },
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function createBatch(data: {
  name: string;
  cultivar: string;
  roomId?: string;
  wetWeight?: number;
  dryTarget?: number;
}) {
  try {
    const userId = await getUserId();
    const batch = await db.batch.create({
      data: {
        name: data.name,
        cultivar: data.cultivar,
        roomId: data.roomId || undefined,
        userId: userId,
        wetWeight: data.wetWeight ?? null,
        dryTarget: data.dryTarget ?? null,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true, batch };
  } catch (error) {
    console.error("Failed to create batch:", error);
    return { success: false, error: "Failed to create batch." };
  }
}

export async function updateBatch(
  batchId: string,
  data: {
    name?: string;
    cultivar?: string;
    roomId?: string | null;
    isActive?: boolean;
    wetWeight?: number | null;
    dryTarget?: number | null;
  }
) {
  try {
    const userId = await getUserId();
    const batch = await db.batch.update({
      where: { id: batchId, userId },
      data: {
        name: data.name,
        cultivar: data.cultivar,
        roomId: data.roomId || undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        wetWeight: data.wetWeight !== undefined ? data.wetWeight : undefined,
        dryTarget: data.dryTarget !== undefined ? data.dryTarget : undefined,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true, batch };
  } catch (error) {
    console.error("Failed to update batch:", error);
    return { success: false, error: "Failed to update batch." };
  }
}

export async function updateBatchTargets(data: {
  batchId: string;
  wetWeight?: number | null;
  dryTarget?: number | null;
}) {
  return updateBatch(data.batchId, {
    wetWeight: data.wetWeight,
    dryTarget: data.dryTarget,
  });
}

export async function deleteBatch(batchId: string) {
  try {
    const userId = await getUserId();
    await db.batch.delete({
      where: { id: batchId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete batch:", error);
    return { success: false, error: "Failed to delete batch." };
  }
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
    orderBy: { startDate: "desc" },
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
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function setActiveBatch(batchId: string) {
  // Frontend state handling placeholder
}

// ==========================================
// PLANT MANAGEMENT
// ==========================================

export async function getPlants() {
  const userId = await getUserId();
  return await db.plant.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPlantsForBatch(batchId: string) {
  const userId = await getUserId();
  return await db.plant.findMany({
    where: { batchId, userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createPlant(data: {
  name: string;
  strain?: string;
  roomId?: string;
  batchId?: string;
  containerGallons?: number;
  wetWeight?: number;
  dryTarget?: number;
}) {
  try {
    const userId = await getUserId();
    const plant = await db.plant.create({
      data: {
        name: data.name,
        strain: data.strain || null,
        roomId: data.roomId || null,
        batchId: data.batchId || null,
        containerGallons: data.containerGallons || null,
        wetWeight: data.wetWeight ?? null,
        dryTarget: data.dryTarget ?? null,
        userId,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true, plant };
  } catch (error) {
    console.error("createPlant error:", error);
    return { success: false, error: "Failed to create plant." };
  }
}

export async function updatePlant(data: {
  id: string;
  name?: string;
  strain?: string | null;
  roomId?: string | null;
  batchId?: string | null;
  containerGallons?: number | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  currentWeight?: number | null;
}) {
  try {
    const userId = await getUserId();
    const plant = await db.plant.update({
      where: { id: data.id, userId },
      data: {
        name: data.name,
        strain: data.strain !== undefined ? data.strain : undefined,
        roomId: data.roomId !== undefined ? data.roomId : undefined,
        batchId: data.batchId !== undefined ? data.batchId : undefined,
        containerGallons: data.containerGallons !== undefined ? data.containerGallons : undefined,
        wetWeight: data.wetWeight !== undefined ? data.wetWeight : undefined,
        dryTarget: data.dryTarget !== undefined ? data.dryTarget : undefined,
        currentWeight: data.currentWeight !== undefined ? data.currentWeight : undefined,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true, plant };
  } catch (error) {
    console.error("updatePlant error:", error);
    return { success: false, error: "Failed to update plant." };
  }
}

export async function deletePlant(plantId: string) {
  try {
    const userId = await getUserId();
    await db.plant.delete({
      where: { id: plantId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/weights");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("deletePlant error:", error);
    return { success: false, error: "Failed to delete plant." };
  }
}

// ==========================================
// DAILY INSIGHTS & BRIEFINGS
// ==========================================

export async function generateDailyBriefing() {
  try {
    const userId = await getUserId();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activePlants, climateLogs, rooms] = await Promise.all([
      db.plant.findMany({
        where: {
          userId,
          batch: {
            isActive: true,
          },
        },
        include: {
          dryBackLogs: {
            where: {
              timestamp: { gte: twentyFourHoursAgo },
            },
            orderBy: { timestamp: "desc" },
            take: 2, // Get the two most recent logs for dry-back trend
          },
          batch: true,
          room: true,
        },
      }),
      db.climateLog.findMany({
        where: {
          userId,
          timestamp: { gte: twentyFourHoursAgo },
        },
        orderBy: { timestamp: "desc" },
      }),
      db.room.findMany({
        where: { userId },
      }),
    ]);

    if (!activePlants.length) {
      return {
        success: true,
        summary: "No active plants found. Please set up your plants to get a daily briefing.",
        insight: null,
        cached: false,
      };
    }

    // --- Facility Snapshot Data ---
    const totalActivePlants = activePlants.length;

    let totalTempC = 0;
    let totalRh = 0;
    let totalVpd = 0;
    climateLogs.forEach((log) => {
      totalTempC += Number(log.airTempC);
      totalRh += Number(log.relativeHumidity);
      totalVpd += Number(
        log.calculatedVpdKpa || computeVPD(Number(log.airTempC), Number(log.relativeHumidity))
      );
    });

    const avgTempC = climateLogs.length ? totalTempC / climateLogs.length : null;
    const avgRh = climateLogs.length ? totalRh / climateLogs.length : null;
    const avgVpd = climateLogs.length ? totalVpd / climateLogs.length : null;

    const plantDryBackTrends: string[] = [];
    let fastDryBackPlants: string[] = [];
    let slowDryBackPlants: string[] = [];
    let nearTargetPlants: string[] = [];

    activePlants.forEach((plant) => {
      if (plant.dryBackLogs.length >= 2) {
        const [latestLog, previousLog] = plant.dryBackLogs;
        const dryBackDiff = Number(latestLog.dryBackPercent) - Number(previousLog.dryBackPercent);
        const wetWeightNum = plant.wetWeight ? Number(plant.wetWeight) : 0;
        const dryTargetNum = plant.dryTarget ? Number(plant.dryTarget) : 0;
        const currentWeightNum = Number(latestLog.currentWeightLbs);

        const dryBackRange = wetWeightNum - dryTargetNum;
        const weightRemainingToTarget = currentWeightNum - dryTargetNum;
        const percentRemaining = dryBackRange > 0 ? (weightRemainingToTarget / dryBackRange) * 100 : 0;


        let trend = "stable";
        if (dryBackDiff > 5) {
          trend = "drying faster than typical";
          fastDryBackPlants.push(`${plant.name} (${plant.batch?.name || 'N/A'} in ${plant.room?.name || 'N/A'})`);
        } else if (dryBackDiff < -5) {
          trend = "drying slower than typical";
          slowDryBackPlants.push(`${plant.name} (${plant.batch?.name || 'N/A'} in ${plant.room?.name || 'N/A'})`);
        }
        plantDryBackTrends.push(
          `${plant.name} (Batch: ${plant.batch?.name || 'N/A'}, Room: ${plant.room?.name || 'N/A'}): ${trend} (latest dry-back: ${Number(latestLog.dryBackPercent).toFixed(1)}%)`
        );

        if (percentRemaining < 20) { // arbitrary threshold for "near target"
          nearTargetPlants.push(`${plant.name} (${plant.batch?.name || 'N/A'})`);
        }

      } else if (plant.dryBackLogs.length === 1) {
        plantDryBackTrends.push(
          `${plant.name} (Batch: ${plant.batch?.name || 'N/A'}, Room: ${plant.room?.name || 'N/A'}): Insufficient data for trend (latest dry-back: ${Number(plant.dryBackLogs[0].dryBackPercent).toFixed(1)}%)`
        );
      } else {
        plantDryBackTrends.push(
          `${plant.name} (Batch: ${plant.batch?.name || 'N/A'}, Room: ${plant.room?.name || 'N/A'}): No dry-back logs in the last 24 hours.`
        );
      }
    });

    // Fallback for limited climate data
    const envSummary = avgTempC !== null
      ? `Temp: ${avgTempC.toFixed(1)}°C (${((avgTempC * 9) / 5 + 32).toFixed(1)}°F), RH: ${avgRh?.toFixed(0)}%, VPD: ${avgVpd?.toFixed(2)} kPa`
      : "Environment data limited for the last 24 hours.";

    let facilityDryBackTrajectory = "Generally stable across the facility.";
    if (fastDryBackPlants.length > activePlants.length / 2) {
      facilityDryBackTrajectory = "Overall facility dry-back is trending faster than typical.";
    } else if (slowDryBackPlants.length > activePlants.length / 2) {
      facilityDryBackTrajectory = "Overall facility dry-back is trending slower than typical.";
    } else if (fastDryBackPlants.length > 0 || slowDryBackPlants.length > 0) {
      facilityDryBackTrajectory = "Mixed dry-back trends observed. Review outliers.";
    }


    const prompt = `
      You are an AI cultivation assistant providing a daily briefing for a facility manager or head grower.
      Analyze the following data for the entire grow operation and provide a concise summary.

      Data for review:
      - Total Active Plants: ${totalActivePlants}
      - Facility-wide Environmental Average (last 24h): ${envSummary}
      - Individual Plant Dry-back Trends:
        ${plantDryBackTrends.join("\n        ")}

      Structure your output into these three bulleted sections:

      *   **Facility Snapshot**: Provide an overview of the total active plants, the general environmental status of the rooms, and the overall dry-back trajectory across the facility.
      *   **Attention Needed / Outliers**: Highlight any specific plants or sub-zones that are exhibiting abnormal dry-back (too fast or too slow), or plants that are nearing their target dry weight.
      *   **Today's Directive**: Offer clear, actionable irrigation and environmental recommendations for the upcoming shift, considering the overall facility health and any identified outliers.
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    // Use 1.5-flash for better instruction following
    const result = await ai.models.generateContent({ model: 'gemini-1.5-flash', contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const summary = result.text?.trim() || "No detailed briefing could be generated.";

    return {
      success: true,
      summary,
      insight: null, // This is a facility-wide briefing, not a single plant insight
      cached: false,
    };
  } catch (error) {
    console.error("AI briefing error:", error);
    return { success: false, error: "Failed to generate briefing or rate limit exceeded." };
  }
}

// Keeping generateDailyInsight for single plant analysis, as it might be used elsewhere or in future
export async function generateDailyInsight(plantId: string) {
  const userId = await getUserId();

  const plant = await db.plant.findFirst({
    where: { id: plantId, userId },
    include: {
      dryBackLogs: {
        orderBy: { timestamp: "desc" },
        take: 48,
      },
    },
  });

  if (!plant) throw new Error("Plant not found");

  const now = new Date();
  const overnightLogs = plant.dryBackLogs.filter((log) => {
    const hours = (now.getTime() - new Date(log.timestamp).getTime()) / (1000 * 60 * 60);
    return hours <= 12 && hours >= 6;
  });

  if (overnightLogs.length < 2) {
    return await db.plantInsight.create({
      data: {
        plantId,
        date: new Date(),
        recommendationType: "monitor",
        recommendationText: "Not enough data for overnight analysis. Log more weights.",
      },
    });
  }

  const sorted = overnightLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const weightLoss = Number(first.currentWeightLbs) - Number(last.currentWeightLbs);

  const wetWeightNum = plant?.wetWeight ? Number(plant.wetWeight) : 18.4;
  const dryTargetNum = plant?.dryTarget ? Number(plant.dryTarget) : 13.2;
  const currentWeightNum = last?.currentWeightLbs ? Number(last.currentWeightLbs) : 0;

  const weightRange = wetWeightNum - dryTargetNum;
  const weightLost = wetWeightNum - currentWeightNum;

  const drybackPercent = weightRange > 0 ? (weightLost / weightRange) * 100 : 0;

  let recommendationType = "monitor";
  let recommendationText = "Monitor plant status.";
  let actionPlan = "";

  if (drybackPercent > 80) {
    recommendationType = "irrigate";
    recommendationText = "Irrigate today – dryback is high.";
    actionPlan = `Feed ${Math.round(wetWeightNum * 0.05 * 1000)}ml at 2.2 EC.`;
  } else if (drybackPercent > 60) {
    recommendationType = "monitor";
    recommendationText = "Dryback progressing. Check again in 4-6 hours.";
  } else if (weightLoss < 0.1 && drybackPercent < 40) {
    recommendationType = "wait";
    recommendationText = "Hold irrigation – moisture is sufficient.";
  } else {
    recommendationType = "monitor";
    recommendationText = "Everything looks stable. Continue current plan.";
  }

  return await db.plantInsight.create({
    data: {
      plantId,
      date: new Date(),
      overnightWeightLoss: weightLoss,
      overnightMoistureStart: 0,
      overnightMoistureEnd: 0,
      overnightVpdAvg: 0,
      recommendationType,
      recommendationText,
      actionPlan,
    },
  });
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
  revalidatePath("/weights");
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
  revalidatePath("/weights");

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
  revalidatePath("/weights");
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
      status = "📈 Recovery phase";
      recommendation = "Continue current irrigation plan. Monitor daily uptake.";
    }
  } else if (percentChange > -5 && percentChange < 5) {
    phase = 4;
    status = "✅ Stable growth";
    recommendation = "Maintain current irrigation plan.";
  } else {
    phase = 5;
    status = "🔄 Moderate dryback";
    recommendation = "Continue monitoring. Adjust irrigation if weight drops below target.";
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
