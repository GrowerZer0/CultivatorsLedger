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
  }),
});

function synthesizeSystemInstruction(context: z.infer<typeof chatRequestSchema>["context"]) {
  const { activeDryBack, reservoirDelta, latestEnvironment, latestRunoffEc } = context;

  const nutrientsList = reservoirDelta.nutrientsToAdd
    .map((n) => `- ${n.product}: ${n.totalMl}ml (${n.mlPerGallon}ml/gal)`)
    .join("\n");

  return `You are an expert commercial cultivation supervisor monitoring live facility telemetry.

CURRENT TELEMETRY CONTEXT:
- Media Dry-Back: ${activeDryBack.dryBackPercent.toFixed(1)}% (${activeDryBack.poundsUntilIrrigation.toFixed(1)} lbs above target limit).
- Irrigation Window: Next watering is dynamically projected in ${activeDryBack.estimatedHoursUntilWater} hours.
- Reservoir Top-Off: Missing volume is exactly ${reservoirDelta.topOffGallons} gallons (${reservoirDelta.waterPercentToAdd}% of total capacity remaining).
- Nutrients Required for Top-Off Volume:
${nutrientsList || "- No nutrients listed in active schedule"}
- Active Climate: ${latestEnvironment ? `${latestEnvironment.temperatureF}°F, ${latestEnvironment.humidity}% RH, ${latestEnvironment.vpd} kPa VPD` : "Sensors offline/No sync data available"}.
- Last Logged Runoff EC: ${latestRunoffEc ?? "N/A"}.

OPERATIONAL RULES:
1. Provide hyper-specific agricultural advice rooted strictly in these numerical metrics.
2. If Runoff EC is elevated (> 2.5), cross-reference with the active top-off matrix and recommend a 10% flush volume.
3. Prioritize Vapour Pressure Deficit (VPD) stability over nutrient tweaks if climate values fall out of the standard 1.1-1.4 kPa flowering sweet spot.
4. Keep feedback clean, direct, concise, and highly professional. Do not hallucinate data.`;
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
    return NextResponse.json({ error: "Failed to communicate with cultivation AI node" }, { status: 500 });
  }
}