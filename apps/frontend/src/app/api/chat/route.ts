import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

// Initialize the modern Google Gen AI Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Loosen parts schema to cleanly accept text strings or inline image data objects
const chatRequestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(["user", "model"]),
      parts: z.array(z.any()), // Allow mixed text/media parts arrays to pass through
    })
  ),
  context: z.object({
    activeDryBack: z.object({
      dryBackPercent: z.number(),
      estimatedHoursUntilWater: z.number(),
      poundsUntilIrrigation: z.number(),
    }),
    reservoirDelta: z.object({
      topOffGallons: z.number(),
      waterPercentToAdd: z.number(),
      nutrientsToAdd: z.array(
        z.object({
          product: z.string(),
          mlPerGallon: z.number(),
          totalMl: z.number(),
        })
      ),
    }),
    latestEnvironment: z.object({
      temperatureF: z.number(),
      humidity: z.number(),
      vpd: z.number(),
    }).optional(),
    latestRunoffEc: z.number().optional(),
        dailyWaterUse: z.number().optional(),
    trendInsights: z.object({
      drybackSpeed: z.object({
        pct: z.number(),
        direction: z.enum(["faster", "slower", "stable"]),
      }).nullable(),
      uptakeTrend: z.object({
        pct: z.number(),
        direction: z.enum(["increasing", "decreasing", "stable"]),
      }).nullable(),
    }).optional(),
    recoveryStatus: z.object({
      phase: z.number(),
      status: z.string(),
      recommendation: z.string(),
    }).optional(),
  }),
});

function synthesizeSystemInstruction(context: z.infer<typeof chatRequestSchema>["context"]) {
  const { activeDryBack, reservoirDelta, latestEnvironment, latestRunoffEc, dailyWaterUse, trendInsights, recoveryStatus, 
  } = context;

  const nutrientsList = reservoirDelta.nutrientsToAdd
    .map((n) => `- ${n.product}: ${n.totalMl}ml (${n.mlPerGallon}ml/gal)`)
    .join("\n");

    // Build insights string
  let insights = "";
  if (trendInsights) {
    if (trendInsights.drybackSpeed) {
      const dir = trendInsights.drybackSpeed.direction;
      const pct = Math.abs(trendInsights.drybackSpeed.pct);
      insights += `- Dryback speed: ${dir}${pct > 0 ? ` (${pct}%)` : ''}\n`;
    }
    if (trendInsights.uptakeTrend) {
      const dir = trendInsights.uptakeTrend.direction;
      const pct = Math.abs(trendInsights.uptakeTrend.pct);
      insights += `- Water uptake trend: ${dir}${pct > 0 ? ` (${pct}%)` : ''}\n`;
    }
  }
  if (dailyWaterUse !== undefined) {
    insights += `- Daily water use: ${dailyWaterUse} lbs/day\n`;
  }
  if (recoveryStatus) {
    insights += `- Recovery phase: ${recoveryStatus.phase} – ${recoveryStatus.status}\n`;
    insights += `- Recovery recommendation: ${recoveryStatus.recommendation}\n`;
  }

  return `You are an AI Grow Coach – a cultivation advisor that uses real‑time telemetry to give actionable, concise, and data‑driven recommendations.

CURRENT TELEMETRY CONTEXT:
- Media Dry‑Back: ${activeDryBack.dryBackPercent.toFixed(1)}% (${activeDryBack.poundsUntilIrrigation.toFixed(1)} lbs above target).
- Irrigation Window: Next watering projected in ${activeDryBack.estimatedHoursUntilWater} hours.
- Reservoir Top‑Off: ${reservoirDelta.topOffGallons} gallons (${reservoirDelta.waterPercentToAdd}% of capacity).
- Nutrients Required:
${nutrientsList || "- No nutrients listed"}
- Climate: ${latestEnvironment ? `${latestEnvironment.temperatureF}°F, ${latestEnvironment.humidity}% RH, ${latestEnvironment.vpd} kPa VPD` : "No live data"}.
- Runoff EC: ${latestRunoffEc !== undefined ? latestRunoffEc : "N/A"}.

${insights ? `ADDITIONAL INSIGHTS:\n${insights}` : ""}

OPERATIONAL RULES:
1. Base your advice strictly on the numbers above – do not guess.
2. If VPD is outside 0.8–1.2 kPa, prioritise environment adjustments.
3. If EC > 2.5, recommend a flush or dilution.
4. If daily water use is increasing, suggest root expansion may be occurring – adjust feed accordingly.
5. Provide a single, clear action (e.g., “Increase irrigation volume by 10%”, “Flush with pH‑balanced water”, “Monitor VPD”).
6. If recovery status is given, incorporate it into your recommendation.

Keep responses brief, professional, and actionable.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Structural Validation
    const result = chatRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid telemetry payload structures" }, { status: 400 });
    }

    const { history, context } = result.data;
    
    // 1. Fully map the conversation history data array safely
    const formattedHistory = history.slice(0, -1).map((msg) => {
      return {
        role: msg.role,
        // Map parts explicitly, preserving text or structural media objects like inlineData
        parts: msg.parts.map((part: any) => {
          if (part.inlineData) {
            return {
              inlineData: {
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType
              }
            };
          }
          return { text: part.text || "" };
        })
      };
    });

    // 2. Extract the exact parts configuration for the final incoming query
    const latestMessageObj = history[history.length - 1];
    const latestParts = latestMessageObj?.parts.map((part: any) => {
      if (part.inlineData) {
        return {
          inlineData: {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          }
        };
      }
      return { text: part.text || "" };
    }) ?? [];

    // 3. Fire content request with the full multi-part payload intact
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [...formattedHistory, { role: "user", parts: latestParts }],
      config: {
        systemInstruction: synthesizeSystemInstruction(context),
        temperature: 0.4,
      },
    });

    return NextResponse.json({ text: response.text });
  } catch (error) {
    console.error("Gemini Edge Route Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI service unavailable" }, { status: 500 });
  }
}