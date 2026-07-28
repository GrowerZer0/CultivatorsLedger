"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";


// ==========================================
// HELPERS & CACHE GLOBALS
// ==========================================

// In-memory cache to prevent infinite render loops from exhausting Gemini API quota
let cachedBriefingResponse: { data: { snapshot: string; attention: string[]; actions: string[] }; timestamp: number } | null = null;
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
    if (!forceRefresh && cachedBriefingResponse && (Date.now() - cachedBriefingResponse.timestamp < ONE_HOUR_MS)) {
      return { success: true as const, ...cachedBriefingResponse.data, cached: true };
    }

    const userId = await getUserId();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activePlants, climateLogs, rooms, irrigationEvents, systemSettings] = await Promise.all([
      db.plant.findMany({
        where: { userId, batch: { isActive: true } },
        include: {
          dryBackLogs: {
            where: { timestamp: { gte: twentyFourHoursAgo } },
            orderBy: { timestamp: "desc" },
            take: 2,
          },
          batch: true,
          room: true,
        },
      }),
      db.climateLog.findMany({
        where: { userId, timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "desc" },
      }),
      db.room.findMany({ where: { userId } }),
      db.irrigationEvent.findMany({
        where: { userId, timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "desc" },
      }),
      db.systemSetting.findFirst({ where: { userId } }),
    ]);

    const preferredUnit = systemSettings?.preferredTempUnit === "F" ? "F" : "C";

    const formatTemp = (tempC: number): string =>
      preferredUnit === "F"
        ? `${((tempC * 9) / 5 + 32).toFixed(1)}°F`
        : `${tempC.toFixed(1)}°C`;

    if (!activePlants.length) {
      return {
        success: true as const,
        snapshot: "No active plants found. Please set up your plants to get a daily briefing.",
        attention: [],
        actions: [],
        cached: false,
      };
    }

    const totalActivePlants = activePlants.length;

    let totalTempC = 0, totalRh = 0, totalVpd = 0;
    let inRangeVpdCount = 0;
    let currentVpdStreak = 0;
    let isCountingCurrentVpdStreak = true;
    climateLogs.forEach((log) => {
      totalTempC += Number(log.airTempC);
      totalRh += Number(log.relativeHumidity);
      const vpd = log.calculatedVpdKpa !== null && log.calculatedVpdKpa !== undefined
        ? Number(log.calculatedVpdKpa)
        : computeVPD(Number(log.airTempC), Number(log.relativeHumidity));
      const isVpdInRange = vpd >= 0.8 && vpd <= 1.2;
      totalVpd += vpd;
      if (isVpdInRange) inRangeVpdCount++;
      if (isCountingCurrentVpdStreak && isVpdInRange) {
        currentVpdStreak++;
      } else {
        isCountingCurrentVpdStreak = false;
      }
    });
    const avgTempC = climateLogs.length ? totalTempC / climateLogs.length : null;
    const avgRh = climateLogs.length ? totalRh / climateLogs.length : null;
    const avgVpd = climateLogs.length ? totalVpd / climateLogs.length : null;
    const vpdScore = climateLogs.length ? (inRangeVpdCount / climateLogs.length) * 100 : null;

    // roomId -> name lookup, since IrrigationEvent stores roomId as a plain string, not a relation
    const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));

    const plantDryBackTrends: string[] = [];
    activePlants.forEach((plant) => {
      const roomName = plant.room?.name || "N/A";
      const batchName = plant.batch?.name || "N/A";

      if (plant.dryBackLogs.length >= 2) {
        const [latestLog, previousLog] = plant.dryBackLogs;
        const latestDryBackPercent = Number(latestLog.dryBackPercent);
        const dryBackSeverity = latestDryBackPercent > 80
          ? "needs irrigation"
          : latestDryBackPercent >= 60
            ? "monitor"
            : "fine";
        const dryBackDiff = latestDryBackPercent - Number(previousLog.dryBackPercent);
        const trend = dryBackDiff > 5 ? "drying faster than typical"
          : dryBackDiff < -5 ? "drying slower than typical"
          : "stable";

        // Explicit null-check, not `||` — a real 0.00 runoff EC must not be treated as "no reading"
        const ecNote = latestLog.runoffEc !== null && latestLog.runoffEc !== undefined
          ? `, runoff EC ${Number(latestLog.runoffEc).toFixed(2)}`
          : "";

        plantDryBackTrends.push(
          `${plant.name} (Batch: ${batchName}, Room: ${roomName}): ${trend} (latest dry-back: ${latestDryBackPercent.toFixed(1)}%, severity: ${dryBackSeverity}${ecNote})`
        );
      } else if (plant.dryBackLogs.length === 1) {
        const latestDryBackPercent = Number(plant.dryBackLogs[0].dryBackPercent);
        const dryBackSeverity = latestDryBackPercent > 80
          ? "needs irrigation"
          : latestDryBackPercent >= 60
            ? "monitor"
            : "fine";
        plantDryBackTrends.push(
          `${plant.name} (Batch: ${batchName}, Room: ${roomName}): Insufficient data for trend (latest dry-back: ${latestDryBackPercent.toFixed(1)}%, severity: ${dryBackSeverity})`
        );
      } else {
        plantDryBackTrends.push(
          `${plant.name} (Batch: ${batchName}, Room: ${roomName}): No dry-back logs in the last 24 hours.`
        );
      }
    });

    const irrigationSummary = irrigationEvents.length
      ? irrigationEvents.map((ev) => {
          const roomName = roomNameById.get(ev.roomId) || ev.roomId;
          const ec = ev.ecLevel !== null && ev.ecLevel !== undefined ? Number(ev.ecLevel).toFixed(1) : "N/A";
          const moistureValue = Number(ev.moisturePercentage);
          const moisture = moistureValue.toFixed(0);
          const flags: string[] = [];
          if (ev.ecLevel !== null && ev.ecLevel !== undefined) {
            const ecValue = Number(ev.ecLevel);
            if (ecValue > 2.0) flags.push("EC high: dilute/flush");
            if (ecValue < 0.8) flags.push("EC low: increase feed");
          }
          if (moistureValue > 80) flags.push("moisture wet: reduce frequency");
          if (moistureValue < 40) flags.push("moisture dry: increase frequency");
          const flagText = flags.length ? `; flags: ${flags.join(", ")}` : "; status: in range";
          return `${roomName} (zone ${ev.zoneId}): EC ${ec}, moisture ${moisture}%${flagText} (${new Date(ev.timestamp).toLocaleTimeString()})`;
        }).join("\n        ")
      : "No irrigation events logged in the last 24 hours.";

const envSummary = avgTempC !== null
  ? `Temp: ${formatTemp(avgTempC)}, RH: ${avgRh?.toFixed(0)}%, VPD: ${avgVpd?.toFixed(2)} kPa`
  : "Environment data limited for the last 24 hours.";

    const vpdHealthSummary = vpdScore !== null
      ? `VPD score: ${vpdScore.toFixed(0)}% of ${climateLogs.length} climate readings in target range 0.8-1.2 kPa; current in-range streak: ${currentVpdStreak} consecutive reading${currentVpdStreak === 1 ? "" : "s"} from most recent.`
      : "VPD score: no climate readings in the last 24 hours.";

    const facilityHealthSummary = [
      vpdHealthSummary,
      `Dry-back severity thresholds: >80% needs irrigation, 60-80% monitor, <60% fine.`,
      `Room-level irrigation health thresholds: EC >2.0 high/dilute or flush, EC <0.8 low/increase feed, moisture >80% wet/reduce frequency, moisture <40% dry/increase frequency.`,
    ].join("\n        ");

    const prompt = `
      You are an AI cultivation assistant. Analyze this facility's full telemetry and respond with ONLY valid JSON, no markdown fences, no preamble.
      All temperatures in your response must be reported in °${preferredUnit} only — never mention or convert to the other unit, anywhere in the response.
      Use the facility health summary to populate attention and actions — this replaces what used to be separate dashboard cards for VPD score, dry-back severity, and room-level EC/moisture status. Do not omit rooms or plants flagged here.

      DATA:
      - Active Plants: ${totalActivePlants}
      - Environment (24h avg): ${envSummary}
      - Dry-back Trends: ${plantDryBackTrends.join("\n        ")}
      - Irrigation Events (24h): ${irrigationSummary}
      - Facility Health Summary: ${facilityHealthSummary}

      Return JSON matching this exact shape:
      {
        "actions": ["imperative, specific action items the grower should take today, e.g. 'Irrigate Room 2', 'Flush Batch 4, runoff EC elevated'. If nothing needed, a single item: 'No action required — hold current schedule.'"]
        "attention": ["specific plant/room callouts with abnormal readings, empty array if none"],
        "snapshot": "one paragraph, current facility state only",

      }
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const rawText = result.text?.trim() || "";
    let parsed: { snapshot: string; attention: string[]; actions: string[] };
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { snapshot: rawText || "No detailed briefing could be generated.", attention: [], actions: [] };
    }

    const data = {
      snapshot: parsed.snapshot,
      attention: parsed.attention || [],
      actions: parsed.actions || [],
    };

    cachedBriefingResponse = { data, timestamp: Date.now() };

    return { success: true as const, ...data, cached: false };
  } catch (error) {
    console.error("AI briefing error:", error instanceof Error ? error.message : error);
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to generate briefing." };
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
