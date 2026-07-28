"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";


export interface DailyCheckInFormData {
  plantId: string;
  weight: number;
  photoUrl?: string;
  watered: boolean;
  fed: boolean;
  trainingEvent: "None" | "Top" | "Defoliate" | "LST" | "Flip" | "Harvest";
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

    // 2. Compute dryback percentage
    const dryBackRange = wet - dryTarget;
    const rawPercent =
      dryBackRange > 0 ? ((wet - data.weight) / dryBackRange) * 100 : 0;
    const dryBackPercent = Math.max(0, Math.min(100, rawPercent));

    // 3. Format compiled notes
    const noteParts: string[] = [];
    if (data.watered) noteParts.push("Watered");
    if (data.fed) noteParts.push("Fed");
    if (data.trainingEvent && data.trainingEvent !== "None") {
      noteParts.push(`Training: ${data.trainingEvent}`);
    }
    if (data.notes?.trim()) noteParts.push(data.notes.trim());

    const compiledNotes =
      noteParts.length > 0 ? noteParts.join(" | ") : "Daily Check-In";

    // 4. Execute atomic database operations
    const result = await db.$transaction(async (tx) => {
      const dryBackLog = await tx.dryBackLog.create({
        data: {
          timestamp: new Date(),
          userId,
          plantId: data.plantId,
          batchId: plant.batchId || null,
          containerGallons,
          wetWeightLbs: wet,
          dryTargetWeightLbs: dryTarget,
          currentWeightLbs: data.weight,
          dryBackPercent,
          notes: compiledNotes,
          unit: "lbs",
          source: "daily_checkin",
        },
      });

      await tx.plant.update({
        where: { id: data.plantId, userId },
        data: { currentWeight: data.weight },
      });

      if (data.watered || data.fed) {
        await tx.irrigationEvent.create({
          data: {
            timestamp: new Date(),
            roomId: "Manual",
            zoneId: "Main",
            moisturePercentage: dryBackPercent,
            isManualEntry: true,
            userId,
            batchId: plant.batchId || null,
            plantId: data.plantId,
          },
        });
      }

      return dryBackLog;
    });

    revalidatePath("/");

    return { success: true, id: result.id };
  } catch (error: any) {
    console.error("recordDailyCheckInLog Error:", error);
    return {
      success: false,
      error: error.message || "Failed to record daily check-in.",
    };
  }
}