"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";

// ==========================================
// BATCH MANAGEMENT
// ==========================================

export async function getBatches() {
  const userId = await getUserId();

  return await db.batch.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    include: { dryBackLogs: true },
  });
}

export async function getBatch(batchId: string) {
  const userId = await getUserId();

  return await db.batch.findUnique({
    where: { id: batchId, userId },
    include: {
      dryBackLogs: {
        where: { userId },
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function createBatch(data: {
  name: string;
  cultivar: string;
  roomId?: string;
  wetWeight?: number;
  dryTarget?: number;
}) {
  try {
    const userId = await getUserId();
    const batch = await db.batch.create({
      data: {
        name: data.name,
        cultivar: data.cultivar,
        roomId: data.roomId || undefined,
        userId: userId,
        wetWeight: data.wetWeight ?? null,
        dryTarget: data.dryTarget ?? null,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, batch };
  } catch (error) {
    console.error("Failed to create batch:", error);
    return { success: false, error: "Failed to create batch." };
  }
}

export async function updateBatch(
  batchId: string,
  data: {
    name?: string;
    cultivar?: string;
    roomId?: string | null;
    isActive?: boolean;
    wetWeight?: number | null;
    dryTarget?: number | null;
  }
) {
  try {
    const userId = await getUserId();
    const batch = await db.batch.update({
      where: { id: batchId, userId },
      data: {
        name: data.name,
        cultivar: data.cultivar,
        roomId: data.roomId || undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        wetWeight: data.wetWeight !== undefined ? data.wetWeight : undefined,
        dryTarget: data.dryTarget !== undefined ? data.dryTarget : undefined,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, batch };
  } catch (error) {
    console.error("Failed to update batch:", error);
    return { success: false, error: "Failed to update batch." };
  }
}

export async function updateBatchTargets(data: {
  batchId: string;
  wetWeight?: number | null;
  dryTarget?: number | null;
}) {
  return updateBatch(data.batchId, {
    wetWeight: data.wetWeight,
    dryTarget: data.dryTarget,
  });
}

export async function deleteBatch(batchId: string) {
  try {
    const userId = await getUserId();
    await db.batch.delete({
      where: { id: batchId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete batch:", error);
    return { success: false, error: "Failed to delete batch." };
  }
}

export async function exportAllBatches() {
  const userId = await getUserId();
  return await db.batch.findMany({
    where: { userId },
    include: {
      dryBackLogs: {
        where: { userId },
      },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getBatchesForComparison(batchIds: string[]) {
  const userId = await getUserId();
  return await db.batch.findMany({
    where: {
      userId,
      id: { in: batchIds },
    },
    include: {
      dryBackLogs: {
        where: { userId },
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function setActiveBatch(batchId: string) {
  // Frontend state handling placeholder
}