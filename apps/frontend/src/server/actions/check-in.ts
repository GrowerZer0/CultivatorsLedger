"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { z } from "zod";
import { checkInSchema, formatZodError } from "@/lib/validation";

export interface DailyCheckInFormData {
  plantId: string;
  weight?: number | null;
  photoUrl?: string;
  watered?: boolean;
  fed?: boolean;
  trainingEvent?: "None" | "Top" | "Defoliate" | "LST" | "Flip" | "Harvest";
  notes?: string;
}

export async function recordDailyCheckInLog(data: unknown) {
  try {
    const validated = checkInSchema.parse(data);
    const userId = await getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized access." };
    }
    // 1. Fetch plant targets
    const plant = await db.plant.findUnique({
      where: { id: validated.plantId, userId },
      select: {
        batchId: true,
        wetWeight: true,
        dryTarget: true,
        containerGallons: true,
      },
    });
    if (!plant) {
      return { success: false, error: "Plant profile not found." };
    }
    const wet = Number(plant.wetWeight ?? 0);
    const dryTarget = Number(plant.dryTarget ?? 0);
    const containerGallons = Number(plant.containerGallons ?? 5);
    // Validate weight: if it's a valid number, use it; otherwise, set to undefined
    const weightValue = 
      validated.weight !== undefined && validated.weight !== null && !isNaN(validated.weight)
        ? validated.weight
        : undefined;
    // 2. Determine if weight is provided
    const hasWeight = weightValue !== undefined;
    // 3. Compute dryback percentage only if weight is provided
    let dryBackPercent = 0;
    if (hasWeight) {
      const dryBackRange = wet - dryTarget;
      const rawPercent = dryBackRange > 0 ? ((wet - weightValue) / dryBackRange) * 100 : 0;
      dryBackPercent = Math.max(0, Math.min(100, rawPercent));
    }
    // 4. Format compiled notes (for DryBackLog, if created)
    const noteParts: string[] = [];
    if (validated.watered) noteParts.push("Watered");
    if (validated.fed) noteParts.push("Fed");
    if (validated.trainingEvent && validated.trainingEvent !== "None") {
      noteParts.push(`Training: ${validated.trainingEvent}`);
    }
    if (validated.notes?.trim()) noteParts.push(validated.notes.trim());
    const compiledNotes = noteParts.length > 0 ? noteParts.join(" | ") : "Daily Check-In";
    // 5. Execute atomic database operations
    const result = await db.$transaction(async (tx) => {
      let dryBackLogId = null;
      // **Only create DryBackLog if weight is provided**
      if (hasWeight) {
        const dryBackLog = await tx.dryBackLog.create({
          data: {
            timestamp: new Date(),
            userId,
            plantId: validated.plantId,
            batchId: plant.batchId || null,
            containerGallons,
            wetWeightLbs: wet,
            dryTargetWeightLbs: dryTarget,
            currentWeightLbs: weightValue as number, 
            dryBackPercent,
            notes: compiledNotes,
            unit: "lbs",
            source: "daily_checkin",
            watered: validated.watered ?? false,
            fed: validated.fed ?? false,
            trainingEvent: validated.trainingEvent ?? null,
          },
        });
        dryBackLogId = dryBackLog.id;
        // Update plant current weight
        await tx.plant.update({
          where: { id: validated.plantId, userId },
          data: { currentWeight: weightValue as number },
        });
      }
      // Create IrrigationEvent if there is any activity
      const hasActivity = validated.watered || validated.fed ||
        (validated.trainingEvent && validated.trainingEvent !== "None") ||
        (validated.notes && validated.notes.trim().length > 0);
      if (hasActivity) {
        await tx.irrigationEvent.create({
          data: {
            timestamp: new Date(),
            roomId: "Manual",
            zoneId: "Main",
            moisturePercentage: hasWeight ? dryBackPercent : null,
            isManualEntry: true,
            userId,
            batchId: plant.batchId || null,
            plantId: validated.plantId,
            notes: compiledNotes, // store the combined notes
          },
        });
      }
      return { dryBackLogId };
    });
    revalidatePath("/");
    return { success: true, id: result.dryBackLogId };
  } catch (error: any) {
    console.error("recordDailyCheckInLog Error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return {
      success: false,
      error: error.message || "Failed to record daily check-in.",
    };
  }
}
