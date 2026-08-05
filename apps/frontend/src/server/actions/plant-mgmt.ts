//apps/frontend/src/server/actions/plant-mgmt.ts

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
// ==========================================
// PLANT MANAGEMENT
// ==========================================
export async function getPlants() {
  const userId = await getUserId();
  return await db.plant.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
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

export async function createPlant(data: unknown) {
  try {
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

    // ✅ Single correct trackEvent call
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

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, plant: serializePrisma(plant) };
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
    // We assume plantSchema has all fields optional except name? But update requires id and allows partial.
    // We'll create a partial schema with required id.
    const updatePlantSchema = plantSchema.partial().extend({ id: z.string() });
    const validated = updatePlantSchema.parse(data);
    const userId = await getUserId();
    const plant = await db.plant.update({
      where: { id: validated.id, userId },
      data: {
        name: validated.name,
        strain: validated.strain !== undefined ? validated.strain : undefined,
        roomId: validated.roomId !== undefined ? validated.roomId : undefined,
        batchId: validated.batchId !== undefined ? validated.batchId : undefined,
        containerGallons: validated.containerGallons !== undefined ? validated.containerGallons : undefined,
        wetWeight: validated.wetWeight !== undefined ? validated.wetWeight : undefined,
        dryTarget: validated.dryTarget !== undefined ? validated.dryTarget : undefined,
        currentWeight: validated.currentWeight !== undefined ? validated.currentWeight : undefined,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
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
    },
  });
  return serializePrisma(plants);
}
