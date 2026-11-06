"use server";
import { db, prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { serializePrisma } from "@/lib/serializePrisma";
import { z } from "zod";
import { formatZodError, plantSchema } from "@/lib/validation";
import { defaultRatelimit } from "@/lib/rate-limit";
import { trackEvent } from '@/lib/analytics/server';
import { canAddPlant } from "@/lib/features";

interface CreatedPlant {
  id: string;
  name: string;
  strain: string | null;
  breeder: string | null;
  roomId: string | null;
  batchId: string | null;
  containerGallons: number | null;
  wetWeight: number | null;
  dryTarget: number | null;
  currentWeight: number | null;
  lightId: string | null;
}

// ==========================================
// PLANT MANAGEMENT
// ==========================================
export async function getPlants() {
  const userId = await getUserId();
  const plants = await db.plant.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      photos: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: { storagePath: true, capturedAt: true },
      },
      sensorConfigs: { select: { id: true, name: true, type: true } },
            stageEvents: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
            dryBackLogs: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { currentWeightLbs: true, timestamp: true, sourceDevice: true },
      },
    },
  });
return serializePrisma(
  plants.map((p) => ({
    ...p,
    thumbnailPath: p.photos[0]?.storagePath ?? null,
    photos: undefined,
    currentStageStartedAt: p.stageEvents?.[0]?.startedAt?.toISOString() ?? null,
  }))
);
}

export async function getPlantsForBatch(batchId: unknown) {
  try {
    const validatedBatchId = z.string().parse(batchId);
    const userId = await getUserId();
    const plants = await db.plant.findMany({
      where: { batchId: validatedBatchId, userId },
      orderBy: { createdAt: "asc" },
    });
    return serializePrisma(plants);
  } catch (error) {
    console.error("getPlantsForBatch error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to fetch plants for batch." };
  }
}

export async function createPlant(
  data: unknown
): Promise<
  | { success: true; plant: CreatedPlant }
  | { success: false; error: string }
> {
  try {
    const validated = plantSchema.parse(data);
    const userId = await getUserId();

    const { allowed, current, limit } = await canAddPlant(userId);
    if (!allowed) {
      return {
        success: false,
        error: `You've reached your limit of ${limit} plants. Please upgrade to add more.`,
      };
    }

    try {
      const { success } = await defaultRatelimit.limit(userId);
      if (!success) {
        return { success: false, error: "Too many plant creations. Please wait." };
      }
    } catch (error) {
      console.warn(
        "Rate limiter failed (likely local dev missing Upstash env vars). Skipping limit.",
        error,
      );
    }

    if (validated.roomId) {
      const roomExists = await db.room.findFirst({
        where: { id: validated.roomId, userId, deletedAt: null },
      });
      if (!roomExists) {
        throw new Error("Invalid room assignment");
      }
    }

    const lightId = (data as any).lightId;

    // Name is optional — auto-fill from strain if empty, otherwise "Plant"
    const finalName =
      validated.name?.trim() ||
      validated.strain?.trim() ||
      "Plant";

    const plant = await db.plant.create({
      data: {
        name: finalName,
        strain: validated.strain || null,
        breeder: validated.breeder || null,
        roomId: validated.roomId || null,
        batchId: validated.batchId || null,
        containerGallons: validated.containerGallons || null,
        wetWeight: validated.wetWeight ?? null,
        dryTarget: validated.dryTarget ?? null,
        userId,
        lightId: lightId || null,
      },
    });

    await trackEvent(
      "plant_added",
      {
        plantId: plant.id,
        name: plant.name,
        strain: plant.strain || undefined,
        breeder: plant.breeder || undefined,
        roomId: plant.roomId || undefined,
        batchId: plant.batchId || undefined,
        containerGallons: plant.containerGallons || undefined,
        wetWeight: plant.wetWeight || undefined,
        dryTarget: plant.dryTarget || undefined,
        lightId: plant.lightId || undefined,
      },
      userId,
    );

    const serializedPlant = serializePrisma(plant) as CreatedPlant;

    revalidatePath("/settings");
    revalidatePath("/");

    return { success: true, plant: serializedPlant };
  } catch (error) {
    console.error("createPlant error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to create plant." };
  }
}

export async function updatePlant(data: unknown) {
  try {
    // Extend schema to include new fields
    const updatePlantSchema = plantSchema.partial().extend({ 
      id: z.string(),
      mirrorPlantId: z.string().nullable().optional(),
      startDate: z.date().nullable().optional(),
      stage: z.string().nullable().optional(),
      flipDate: z.date().nullable().optional(),
      lightId: z.string().nullable().optional(),
    });
    const validated = updatePlantSchema.parse(data);
    const userId = await getUserId();
    
    // Build data object with only defined fields
    const updateData: any = {};
    
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.strain !== undefined) updateData.strain = validated.strain;
    if (validated.breeder !== undefined) updateData.breeder = validated.breeder;
    if (validated.roomId !== undefined) updateData.roomId = validated.roomId;
    if (validated.batchId !== undefined) updateData.batchId = validated.batchId;
    if (validated.containerGallons !== undefined) updateData.containerGallons = validated.containerGallons;
    if (validated.wetWeight !== undefined) updateData.wetWeight = validated.wetWeight;
    if (validated.dryTarget !== undefined) updateData.dryTarget = validated.dryTarget;
    if (validated.currentWeight !== undefined) updateData.currentWeight = validated.currentWeight;
    if (validated.mirrorPlantId !== undefined) updateData.mirrorPlantId = validated.mirrorPlantId;
    if (validated.stage !== undefined) updateData.stage = validated.stage;
    if (validated.flipDate !== undefined) updateData.flipDate = validated.flipDate;
    if (validated.lightId !== undefined) updateData.lightId = validated.lightId;
    // Handle startDate - only set if not null, otherwise skip (keep existing)
    if (validated.startDate !== undefined && validated.startDate !== null) {
      updateData.startDate = validated.startDate;
    }

    const plant = await db.plant.update({
      where: { id: validated.id, userId },
      data: updateData,
    });
    
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/plants");
    revalidatePath(`/plants/${plant.id}`);
    
    return { success: true, plant: serializePrisma(plant) };
  } catch (error) {
    console.error("updatePlant error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to update plant." };
  }
}

export async function deletePlant(plantId: unknown) {
  try {
    const validatedPlantId = z.string().parse(plantId);
    const userId = await getUserId();
    await db.plant.delete({
      where: { id: validatedPlantId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("deletePlant error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to delete plant." };
  }
}

export async function fetchPlants() {
  const userId = await getUserId();
  const plants = await prisma.plant.findMany({
    where: { userId, archivedAt: null },
    select: {
      id: true,
      name: true,
      strain: true,
      breeder: true,
      roomId: true,
      batchId: true,
      containerGallons: true,
      wetWeight: true,
      dryTarget: true,
      currentWeight: true,
      lightId: true,
      mirrorPlantId: true,
      startDate: true,
      stage: true,
      flipDate: true,
      sensorConfigs: { select: { id: true, name: true, type: true } }, // ADD
      dryBackLogs: { orderBy: { timestamp: "desc" }, take: 1, select: { currentWeightLbs: true, timestamp: true } }, // ADD
      photos: { orderBy: { capturedAt: "desc" }, take: 1, select: { storagePath: true } },
    },
  });

  const paths = plants.map((p) => p.photos[0]?.storagePath).filter((p): p is string => !!p);
  const { getPhotoUrls } = await import("./photos");
  const urlByPath = await getPhotoUrls(paths);

  return serializePrisma(
    plants.map((p) => {
      const sp = p.photos[0]?.storagePath;
      return {
        ...p,
        thumbnailUrl: sp ? urlByPath[sp] ?? null : null,
        photos: undefined,
        currentWeight: p.dryBackLogs[0] ? Number(p.dryBackLogs[0].currentWeightLbs) : p.currentWeight,
        currentWeightTimestamp: p.dryBackLogs[0] ? p.dryBackLogs[0].timestamp.toISOString() : null,
      };
    })
  );
}

export async function archivePlant(plantId: string) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    await db.plant.update({
      where: { id: plantId, userId },
      data: { archivedAt: new Date() },
    });

    revalidatePath("/plants");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("archivePlant error:", error);
    return { success: false, error: "Failed to archive plant." };
  }
}
// ==========================================
// SCALE SETTINGS (Field Capacity / Tare)
// ==========================================

/**
 * Returns the latest weight reading for a plant, so the Scale Settings modal
 * can show the user what the scale is *currently* reading before they
 * commit it as Field Capacity.
 *
 * We read from the most recent DryBackLog (written by the ESP32 poller).
 */
export async function getLatestScaleReading(plantId: unknown) {
  try {
    const id = z.string().parse(plantId);
    const userId = await getUserId();

    const plant = await db.plant.findFirst({
      where: { id, userId },
      select: { id: true, wetWeight: true, name: true },
    });
    if (!plant) return { success: false as const, error: "Plant not found." };

    const latestLog = await db.dryBackLog.findFirst({
      where: { plantId: id },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        currentWeightLbs: true,
        sourceDevice: true,
      },
    });

return {
  success: true as const,
  plant: {
    id: plant.id,
    name: plant.name,
    wetWeight: plant.wetWeight !== null ? Number(plant.wetWeight) : null,
  },
  latestLog: latestLog
    ? {
        id: latestLog.id,
        timestamp: latestLog.timestamp.toISOString(),
        currentWeightLbs:
          latestLog.currentWeightLbs !== null
            ? Number(latestLog.currentWeightLbs)
            : null,
        sourceDevice: latestLog.sourceDevice,
      }
    : null,
};
  } catch (error) {
    console.error("getLatestScaleReading error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: formatZodError(error) };
    }
    return { success: false as const, error: "Failed to fetch scale reading." };
  }
}

/**
 * Sets Field Capacity for a plant directly from the app.
 *
 * "Field Capacity" = the saturated weight of the pot right after watering
 * (a.k.a. wet weight). The dryback % on the dashboard is calculated as:
 *
 *     dryback% = ((wetWeight - currentWeight) / wetWeight) * 100
 *
 * If `weightLbs` is omitted, we use the most recent DryBackLog reading
 * (i.e. "Set FC to whatever the scale is reading right now").
 */
export async function setFieldCapacity(data: unknown) {
  try {
    const schema = z.object({
      plantId: z.string(),
      weightLbs: z.number().positive().nullable().optional(),
    });
    const { plantId, weightLbs } = schema.parse(data);
    const userId = await getUserId();

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      select: { id: true, name: true },
    });
    if (!plant) return { success: false as const, error: "Plant not found." };

    let resolvedWeight = weightLbs ?? null;

    // Fall back to latest reading if caller didn't supply a weight
    if (resolvedWeight === null) {
      const latestLog = await db.dryBackLog.findFirst({
        where: { plantId },
        orderBy: { timestamp: "desc" },
        select: { currentWeightLbs: true },
      });
      if (!latestLog) {
        return {
          success: false as const,
          error:
            "No scale reading available. Log a reading first, or enter a weight manually.",
        };
      }
      resolvedWeight = Number(latestLog.currentWeightLbs);
    }

    if (!resolvedWeight || resolvedWeight <= 0) {
      return {
        success: false as const,
        error: "Field capacity must be a positive weight.",
      };
    }

    await db.plant.update({
      where: { id: plantId, userId },
      data: { wetWeight: resolvedWeight },
    });

    await trackEvent(
      "field_capacity_set",
      { plantId, weightLbs: resolvedWeight },
      userId
    );

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true as const,
      wetWeight: resolvedWeight,
    };
  } catch (error) {
    console.error("setFieldCapacity error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: formatZodError(error) };
    }
    return { success: false as const, error: "Failed to set field capacity." };
  }
}

/**
 * "Tare" for load cells = zero the scale with an EMPTY container on it,
 * then re-establish Field Capacity relative to the current reading.
 *
 * Because the load cell firmware is what actually zeros the ADC, we can't
 * tare from the server. Instead, this action:
 *   1. Records the current (unloaded) reading as a new baseline in
 *      DryBackLog so the chart doesn't spike.
 *   2. Clears `wetWeight` so the user is forced to re-set FC after
 *      putting the plant back on the scale.
 *
 * The ESP32 firmware *also* needs to be told to tare its ADC — see the
 * note in the modal UI ("Make sure the pot is off the scale, then tap
 * Tare on the ESP32 web page; tap here only after that to re-establish FC").
 */
export async function tareScale(data: unknown) {
  try {
    const schema = z.object({
      plantId: z.string(),
      rawReadingLbs: z.number().nullable().optional(),
    });
    const { plantId, rawReadingLbs } = schema.parse(data);
    const userId = await getUserId();

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      select: { id: true, name: true },
    });
    if (!plant) return { success: false as const, error: "Plant not found." };

    await db.plant.update({
      where: { id: plantId, userId },
      data: { wetWeight: null },
    });

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true as const,
      message:
        "Field capacity cleared. Tare the physical scale (ESP32 web page), then Set FC again with the saturated pot on the scale.",
      rawReadingLbs: rawReadingLbs ?? null,
    };
  } catch (error) {
    console.error("tareScale error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: formatZodError(error) };
    }
    return { success: false as const, error: "Failed to tare scale." };
  }
}