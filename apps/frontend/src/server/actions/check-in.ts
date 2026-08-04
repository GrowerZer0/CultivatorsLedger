//apps/frontend/src/server/actions/check-in.ts
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
export interface DailyCheckInFormData {
  plantId: string;
  weight?: number | null;
  photoUrl?: string;
  watered?: boolean;
  fed?: boolean;
  trainingEvent?: "None" | "Top" | "Defoliate" | "LST" | "Flip" | "Harvest";
  notes?: string;
}
export async function recordDailyCheckInLog(data: DailyCheckInFormData) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized access." };
    }
    // 1. Fetch plant targets
    const plant = await db.plant.findUnique({
      where: { id: data.plantId, userId },
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
      data.weight !== undefined && data.weight !== null && !isNaN(data.weight)
        ? data.weight
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
    if (data.watered) noteParts.push("Watered");
    if (data.fed) noteParts.push("Fed");
    if (data.trainingEvent && data.trainingEvent !== "None") {
      noteParts.push(`Training: ${data.trainingEvent}`);
    }
    if (data.notes?.trim()) noteParts.push(data.notes.trim());
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
          plantId: data.plantId,
          batchId: plant.batchId || null,
          containerGallons,
          wetWeightLbs: wet,
          dryTargetWeightLbs: dryTarget,
          currentWeightLbs: data.weight as number, 
          dryBackPercent,
          notes: compiledNotes,
          unit: "lbs",
          source: "daily_checkin",
          watered: data.watered ?? false,
          fed: data.fed ?? false,
          trainingEvent: data.trainingEvent ?? null,
        },
      });
        dryBackLogId = dryBackLog.id;
        // Update plant current weight
        await tx.plant.update({
          where: { id: data.plantId, userId },
          data: { currentWeight: data.weight as number },
        });
      }
            // Create IrrigationEvent if there is any activity
      const hasActivity = data.watered || data.fed ||
        (data.trainingEvent && data.trainingEvent !== "None") ||
        (data.notes && data.notes.trim().length > 0);
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
            plantId: data.plantId,
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
    return {
      success: false,
      error: error.message || "Failed to record daily check-in.",
    };
  }
}