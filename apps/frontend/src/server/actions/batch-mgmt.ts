"use server";
import { db, prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { serializePrisma } from "@/lib/serializePrisma";
import { z } from "zod";
import { batchSchema, formatZodError } from "@/lib/validation";

// ==========================================
// BATCH MANAGEMENT
// ==========================================

// ─── Read ──────────────────────────────────
export async function getBatches() {
  const userId = await getUserId();
  const batches = await db.batch.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    include: { dryBackLogs: true },
  });
  return serializePrisma(batches);
}

export async function getBatch(batchId: string) {
  // Validate batchId (optional but good practice)
  const idSchema = z.string().cuid();
  const parsed = idSchema.safeParse(batchId);
  if (!parsed.success) {
    return null; // or throw
  }
  const userId = await getUserId();
  const batch = await db.batch.findUnique({
    where: { id: batchId, userId },
    include: {
      dryBackLogs: {
        where: { userId },
        orderBy: { timestamp: "asc" },
      },
    },
  });
  return serializePrisma(batch);
}

// ─── Create ─────────────────────────────────
export async function createBatch(data: unknown) {
  try {
    // Validate using batchSchema (which requires name, cultivar)
    const validated = batchSchema.parse(data);
    const userId = await getUserId();

    // Additional fields not in schema (wetWeight, dryTarget, startDate, isActive)
    // We'll accept them as optional extras
    const extras = data as {
      wetWeight?: number | null;
      dryTarget?: number | null;
      startDate?: Date | string;
      isActive?: boolean;
    };

    const batch = await db.batch.create({
      data: {
        name: validated.name,
        cultivar: validated.cultivar,
        roomId: validated.roomId || undefined,
        userId: userId,
        wetWeight: extras.wetWeight ?? null,
        dryTarget: extras.dryTarget ?? null,
        startDate: extras.startDate || undefined,
        isActive: extras.isActive ?? true,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, batch: serializePrisma(batch) };
  } catch (error) {
    console.error("Failed to create batch:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to create batch." };
  }
}

// ─── Update ─────────────────────────────────
export async function updateBatch(
  batchId: string,
  data: unknown
) {
  try {
    // Validate batchId
    const idSchema = z.string().cuid();
    idSchema.parse(batchId);

    // Validate update data (partial batch schema)
    const updateSchema = batchSchema.partial(); // all fields optional
    const validated = updateSchema.parse(data);

    const userId = await getUserId();
    const batch = await db.batch.update({
      where: { id: batchId, userId },
      data: {
        name: validated.name,
        cultivar: validated.cultivar,
        roomId: validated.roomId ?? undefined,
        isActive: validated.isActive !== undefined ? validated.isActive : undefined,
        wetWeight: (data as any).wetWeight !== undefined ? (data as any).wetWeight : undefined,
        dryTarget: (data as any).dryTarget !== undefined ? (data as any).dryTarget : undefined,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, batch: serializePrisma(batch) };
  } catch (error) {
    console.error("Failed to update batch:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to update batch." };
  }
}

// ─── Update Targets (wrapper) ──────────────
export async function updateBatchTargets(data: unknown) {
  const schema = z.object({
    batchId: z.string().cuid(),
    wetWeight: z.number().nullable().optional(),
    dryTarget: z.number().nullable().optional(),
  });
  try {
    const parsed = schema.parse(data);
    return updateBatch(parsed.batchId, {
      wetWeight: parsed.wetWeight,
      dryTarget: parsed.dryTarget,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Invalid input." };
  }
}

// ─── Delete ─────────────────────────────────
export async function deleteBatch(batchId: string) {
  try {
    const idSchema = z.string().cuid();
    idSchema.parse(batchId);

    const userId = await getUserId();

    // 1. Unassign all plants in this batch (set batchId null)
    await db.plant.updateMany({
      where: { batchId, userId },
      data: { batchId: null },
    });

    // 2. Unassign all dryBackLogs in this batch (set batchId null)
    await db.dryBackLog.updateMany({
      where: { batchId, userId },
      data: { batchId: null },
    });

    // 3. Delete the batch
    await db.batch.delete({
      where: { id: batchId, userId },
    });

    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/batches");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete batch:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    return { success: false, error: "Failed to delete batch." };
  }
}

// ─── Export / Comparison ────────────────────
export async function exportAllBatches() {
  const userId = await getUserId();
  const batches = await db.batch.findMany({
    where: { userId },
    include: {
      dryBackLogs: {
        where: { userId },
      },
    },
    orderBy: { startDate: "desc" },
  });
  return serializePrisma(batches);
}

export async function getBatchesForComparison(batchIds: string[]) {
  // Validate array of CUIDs
  const arraySchema = z.array(z.string().cuid());
  const parsed = arraySchema.safeParse(batchIds);
  if (!parsed.success) {
    return []; // or throw
  }
  const userId = await getUserId();
  const batches = await db.batch.findMany({
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
  return serializePrisma(batches);
}

export async function fetchBatches() {
  const userId = await getUserId();
  const batches = await prisma.batch.findMany({
    where: { userId: userId },
    select: {
      id: true,
      name: true,
      cultivar: true,
      roomId: true,
      isActive: true,
      wetWeight: true,
      dryTarget: true,
    },
  });
  return serializePrisma(batches);
}