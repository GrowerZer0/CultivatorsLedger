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
  roomId: string | null;
  batchId: string | null;
  containerGallons: number | null;
  wetWeight: number | null;
  dryTarget: number | null;
  currentWeight: number | null;
}

// ==========================================
// PLANT MANAGEMENT
// ==========================================
export async function getPlants() {
  const userId = await getUserId();
  const plants = await db.plant.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return serializePrisma(plants);
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
> {  try {
    const validated = plantSchema.parse(data);
    const userId = await getUserId();

    const { allowed, current, limit } = await canAddPlant(userId);
    if (!allowed) {
      return { 
        success: false, 
        error: `You've reached your limit of ${limit} plants. Please upgrade to add more.` 
      };
    }

    const { success } = await defaultRatelimit.limit(userId);
    if (!success) {
      return { success: false, error: "Too many plant creations. Please wait." };
    }
    if (validated.roomId) {
      const roomExists = await db.room.findFirst({
        where: { id: validated.roomId, userId },
      });
      if (!roomExists) {
        throw new Error("Invalid room assignment");
      }
    }
    const plant = await db.plant.create({
      data: {
        name: validated.name,
        strain: validated.strain || null,
        roomId: validated.roomId || null,
        batchId: validated.batchId || null,
        containerGallons: validated.containerGallons || null,
        wetWeight: validated.wetWeight ?? null,
        dryTarget: validated.dryTarget ?? null,
        userId,
      },
    });

    await trackEvent('plant_added', {
      plantId: plant.id,
      name: plant.name,
      strain: plant.strain || undefined,
      roomId: plant.roomId || undefined,
      batchId: plant.batchId || undefined,
      containerGallons: plant.containerGallons || undefined,
      wetWeight: plant.wetWeight || undefined,
      dryTarget: plant.dryTarget || undefined,
    }, userId);
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
    });
    const validated = updatePlantSchema.parse(data);
    const userId = await getUserId();
    
    // Build data object with only defined fields
    const updateData: any = {};
    
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.strain !== undefined) updateData.strain = validated.strain;
    if (validated.roomId !== undefined) updateData.roomId = validated.roomId;
    if (validated.batchId !== undefined) updateData.batchId = validated.batchId;
    if (validated.containerGallons !== undefined) updateData.containerGallons = validated.containerGallons;
    if (validated.wetWeight !== undefined) updateData.wetWeight = validated.wetWeight;
    if (validated.dryTarget !== undefined) updateData.dryTarget = validated.dryTarget;
    if (validated.currentWeight !== undefined) updateData.currentWeight = validated.currentWeight;
    if (validated.mirrorPlantId !== undefined) updateData.mirrorPlantId = validated.mirrorPlantId;
    if (validated.stage !== undefined) updateData.stage = validated.stage;
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
    where: { userId },
    select: {
      id: true,
      name: true,
      strain: true,
      roomId: true,
      batchId: true,
      containerGallons: true,
      wetWeight: true,
      dryTarget: true,
      currentWeight: true,
      mirrorPlantId: true,
      startDate: true,
      stage: true,
    },
  });
  return serializePrisma(plants);
}
