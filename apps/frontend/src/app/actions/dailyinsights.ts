"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
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

// ==========================================
// DAILY INSIGHTS & BRIEFINGS
// ==========================================

export async function generateDailyBriefing(forceRefresh: boolean = false) {
  try {
    // 🛡️ CIRCUIT BREAKER: Check cached response unless explicit user forceRefresh
    if (!forceRefresh && cachedBriefingResponse && (Date.now() - cachedBriefingResponse.timestamp < ONE_HOUR_MS)) {
      return {
        success: true,
        summary: cachedBriefingResponse.summary,
        insight: null,
        cached: true,
      };
    }

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
            take: 2,
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

        if (percentRemaining < 20) {
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

    const prompt = `
      You are an AI cultivation assistant providing a daily briefing for a facility manager or head grower.
      Analyze the following data for the entire grow operation and provide a concise summary.

      Data for review:
      - Total Active Plants: ${totalActivePlants}
      - Facility-wide Environmental Average (last 24h): ${envSummary}
      - Individual Plant Dry-back Trends:
        ${plantDryBackTrends.join("\n        ")}

      Structure your output into these three bulleted sections:

      * **Facility Snapshot**: Provide an overview of the total active plants, the general environmental status of the rooms, and the overall dry-back trajectory across the facility.
      * **Attention Needed / Outliers**: Highlight any specific plants or sub-zones that are exhibiting abnormal dry-back (too fast or too slow), or plants that are nearing their target dry weight.
      * **Today's Directive**: Offer clear, actionable irrigation and environmental recommendations for the upcoming shift, considering the overall facility health and any identified outliers.
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({ 
      model: 'gemini-1.5-flash', 
      contents: [{ role: 'user', parts: [{ text: prompt }] }] 
    });
    
    const summary = result.text?.trim() || "No detailed briefing could be generated.";

    // Save to memory cache
    cachedBriefingResponse = { summary, timestamp: Date.now() };

    return {
      success: true,
      summary,
      insight: null,
      cached: false,
    };
  } catch (error) {
    console.error("AI briefing error:", error);
    return { success: false, error: "Failed to generate briefing or rate limit exceeded." };
  }
}

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