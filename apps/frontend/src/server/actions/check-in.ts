"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { z } from "zod";
import { formatZodError } from "@/lib/validation";
import { defaultRatelimit } from "@/lib/rate-limit";

export interface DailyCheckInFormData {
  plantId: string;
  weight?: number | null;
  unit?: "lbs" | "g";
  photoUrl?: string;
  watered?: boolean;
  fed?: boolean;
  trainingEvent?: "None" | "Top" | "Defoliate" | "LST" | "Flip" | "Harvest";
  notes?: string;
}

// Stricter than the shared checkInSchema — the shared one is used by older
// callers who don't send unit. This one enforces weight > 0 or null.
const recordCheckInSchema = z.object({
  plantId: z.string().cuid("Valid plant ID is required"),
  // weight can be omitted/null (activity-only check-in) but must be >0 if present
  weight: z
    .number()
    .positive("Weight must be greater than 0")
    .max(10000)
    .nullable()
    .optional(),
  unit: z.enum(["lbs", "g"]).default("lbs"),
  watered: z.boolean().default(false),
  fed: z.boolean().default(false),
  trainingEvent: z
    .enum(["None", "Top", "Defoliate", "LST", "Flip", "Harvest"])
    .default("None"),
  notes: z.string().max(500).optional().nullable(),
});

export async function recordDailyCheckInLog(data: unknown) {
  try {
    const validated = recordCheckInSchema.parse(data);
    const userId = await getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized access." };
    }

    const { success } = await defaultRatelimit.limit(userId);
    if (!success) {
      return { success: false, error: "Too many check-in requests. Please slow down." };
    }

    // 1. Fetch plant targets
    const plant = await db.plant.findUnique({
      where: { id: validated.plantId, userId },
      select: {
        batchId: true,
        wetWeight: true,   // Field Capacity
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

    // 2. Normalize weight to lbs (canonical unit for the DB)
    let weightLbs: number | undefined;
    if (validated.weight !== undefined && validated.weight !== null) {
      if (validated.weight <= 0) {
        return { success: false, error: "Weight must be greater than 0." };
      }
      weightLbs = validated.unit === "g" ? validated.weight / 453.592 : validated.weight;
    }
    const hasWeight = weightLbs !== undefined;

    // 3. Guard: dryback requires FC
    if (hasWeight && wet <= 0) {
      return {
        success: false,
        error:
          "Field capacity not set for this plant. Open Scale Settings and set FC before logging a reading.",
      };
    }

    // 4. Compute dryback — MUST match PlantStatusList / PlantDetailClient:
    //      dryback = ((wet - current) / wet) * 100
    // Not ((wet - current) / (wet - dryTarget)).
    let dryBackPercent = 0;
    if (hasWeight) {
      dryBackPercent = Math.max(0, ((wet - weightLbs!) / wet) * 100);
      // No upper clamp — dryback > 100% means the plant went below its
      // dry target, which is useful information, not something to hide.
    }

    // 5. Compile notes
    const noteParts: string[] = [];
    if (validated.watered) noteParts.push("Watered");
    if (validated.fed) noteParts.push("Fed");
    if (validated.trainingEvent && validated.trainingEvent !== "None") {
      noteParts.push(`Training: ${validated.trainingEvent}`);
    }
    if (validated.notes?.trim()) noteParts.push(validated.notes.trim());
    const compiledNotes =
      noteParts.length > 0 ? noteParts.join(" | ") : "Daily Check-In";

    // 6. Atomic DB ops
    const result = await db.$transaction(async (tx) => {
      let dryBackLogId: number | null = null;

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
            currentWeightLbs: weightLbs!,
            dryBackPercent,
            notes: compiledNotes,
            unit: "lbs",           // canonical unit — always lbs in DB
            source: "daily_checkin",
            watered: validated.watered,
            fed: validated.fed,
            trainingEvent: validated.trainingEvent,
          },
        });
        dryBackLogId = dryBackLog.id;

        await tx.plant.update({
          where: { id: validated.plantId, userId },
          data: { currentWeight: weightLbs! },
        });
      }

      const hasActivity = Boolean(
        validated.watered ||
          validated.fed ||
          (validated.trainingEvent && validated.trainingEvent !== "None"),
      );

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
            notes: compiledNotes,
          },
        });
      }

      return { dryBackLogId };
    });

    revalidatePath("/");
    revalidatePath(`/plants/${validated.plantId}`);
    revalidatePath("/dashboard");
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
export async function recordIrrigation(data: {
  plantId: string;
  preWeightLbs: number | null;
  postWeightLbs: number | null;
  watered: boolean;
  fed: boolean;
  feedPh?: number | null;
  feedEc?: number | null;
  runoffVolumeMl?: number | null;
  runoffPh?: number | null;
  runoffEc?: number | null;
  notes?: string | null;
  updateFieldCapacity?: boolean;
}) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    const plant = await db.plant.findUnique({
      where: { id: data.plantId, userId },
      select: { wetWeight: true, dryTarget: true, containerGallons: true, batchId: true },
    });
    if (!plant) return { success: false, error: "Plant not found" };

    const wet = Number(plant.wetWeight ?? 0);
    const dry = Number(plant.dryTarget ?? 0);

    // We need a post-weight to compute volume
    if (data.postWeightLbs === null) {
      return { success: false, error: "Post-water weight is required." };
    }

    // Compute water volume from weight delta
    let waterVolumeMl = null;
    if (data.preWeightLbs !== null && data.postWeightLbs !== null) {
      const deltaLbs = data.postWeightLbs - data.preWeightLbs;
      // 1 lb of water ≈ 453.592 ml
      waterVolumeMl = Math.round(deltaLbs * 453.592);
    }

    // Compute dryback % from post-weight
    let dryBackPercent = 0;
    if (wet > 0 && data.postWeightLbs !== null) {
      dryBackPercent = Math.max(0, ((wet - data.postWeightLbs) / wet) * 100);
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Create the primary log (post-water)
      const log = await tx.dryBackLog.create({
        data: {
          timestamp: new Date(),
          userId,
          plantId: data.plantId,
          batchId: plant.batchId,
          containerGallons: plant.containerGallons ?? 0,
          wetWeightLbs: wet,
          dryTargetWeightLbs: dry,
          currentWeightLbs: data.postWeightLbs!,
          dryBackPercent: dryBackPercent,
          watered: data.watered,
          fed: data.fed,
          trainingEvent: null,
          notes: data.notes ?? "Irrigation",
          unit: "lbs",
          source: "irrigation",
          isPreWater: false,
          isPostWater: true,
          waterVolumeMl: waterVolumeMl,
          feedPh: data.feedPh ?? null,
          feedEc: data.feedEc ?? null,
          runoffVolumeMl: data.runoffVolumeMl ?? null,
          runoffPh: data.runoffPh ?? null,
          runoffEc: data.runoffEc ?? null,
        },
      });

      // 2. Create the pre-water log if we have it (for the timeline)
      if (data.preWeightLbs !== null) {
        await tx.dryBackLog.create({
          data: {
            timestamp: new Date(Date.now() - 1000), // 1s earlier so it sorts first
            userId,
            plantId: data.plantId,
            batchId: plant.batchId,
            containerGallons: plant.containerGallons ?? 0,
            wetWeightLbs: wet,
            dryTargetWeightLbs: dry,
            currentWeightLbs: data.preWeightLbs,
            dryBackPercent: wet > 0 ? Math.max(0, ((wet - data.preWeightLbs) / wet) * 100) : 0,
            watered: false,
            fed: false,
            trainingEvent: null,
            notes: "Pre-water weight",
            unit: "lbs",
            source: "irrigation",
            isPreWater: true,
            isPostWater: false,
            parentLogId: log.id.toString(),
          },
        });
      }

      // 3. Update Field Capacity if requested (or if pre-weight > FC)
      if (data.updateFieldCapacity && data.postWeightLbs !== null) {
        await tx.plant.update({
          where: { id: data.plantId },
          data: { wetWeight: data.postWeightLbs },
        });
      }

      // 4. Update plant currentWeight
      await tx.plant.update({
        where: { id: data.plantId },
        data: { currentWeight: data.postWeightLbs },
      });

      return { logId: log.id };
    });

    revalidatePath("/dashboard");
    revalidatePath(`/plants/${data.plantId}`);

    return { success: true, logId: result.logId };
  } catch (error) {
    console.error("recordIrrigation error:", error);
    return { success: false, error: "Failed to record irrigation" };
  }
}