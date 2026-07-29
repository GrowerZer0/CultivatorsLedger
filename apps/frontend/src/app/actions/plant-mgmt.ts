"use server";

import { db, prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";


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

export async function getPlantsForBatch(batchId: string) {
  const userId = await getUserId();
  return await db.plant.findMany({
    where: { batchId, userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createPlant(data: {
  name: string;
  strain?: string;
  roomId?: string;
  batchId?: string;
  containerGallons?: number;
  wetWeight?: number;
  dryTarget?: number;
}) {
  try {
    const userId = await getUserId();
    const plant = await db.plant.create({
      data: {
        name: data.name,
        strain: data.strain || null,
        roomId: data.roomId || null,
        batchId: data.batchId || null,
        containerGallons: data.containerGallons || null,
        wetWeight: data.wetWeight ?? null,
        dryTarget: data.dryTarget ?? null,
        userId,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, plant };
  } catch (error) {
    console.error("createPlant error:", error);
    return { success: false, error: "Failed to create plant." };
  }
}

export async function updatePlant(data: {
  id: string;
  name?: string;
  strain?: string | null;
  roomId?: string | null;
  batchId?: string | null;
  containerGallons?: number | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  currentWeight?: number | null;
}) {
  try {
    const userId = await getUserId();
    const plant = await db.plant.update({
      where: { id: data.id, userId },
      data: {
        name: data.name,
        strain: data.strain !== undefined ? data.strain : undefined,
        roomId: data.roomId !== undefined ? data.roomId : undefined,
        batchId: data.batchId !== undefined ? data.batchId : undefined,
        containerGallons: data.containerGallons !== undefined ? data.containerGallons : undefined,
        wetWeight: data.wetWeight !== undefined ? data.wetWeight : undefined,
        dryTarget: data.dryTarget !== undefined ? data.dryTarget : undefined,
        currentWeight: data.currentWeight !== undefined ? data.currentWeight : undefined,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, plant };
  } catch (error) {
    console.error("updatePlant error:", error);
    return { success: false, error: "Failed to update plant." };
  }
}

export async function deletePlant(plantId: string) {
  try {
    const userId = await getUserId();
    await db.plant.delete({
      where: { id: plantId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("deletePlant error:", error);
    return { success: false, error: "Failed to delete plant." };
  }
}

export async function fetchPlants() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const plants = await prisma.plant.findMany({
    where: { userId: user.id },
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
  return plants.map(p => ({
    ...p,
    containerGallons: p.containerGallons ? Number(p.containerGallons) : null,
    wetWeight: p.wetWeight ? Number(p.wetWeight) : null,
    dryTarget: p.dryTarget ? Number(p.dryTarget) : null,
  }));
}