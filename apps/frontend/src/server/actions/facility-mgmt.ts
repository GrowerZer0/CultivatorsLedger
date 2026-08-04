"use server";
import { db, prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { serializePrisma } from "@/lib/serializePrisma";
import { z } from "zod";
import { roomSchema } from "@/lib/validation";

// ==========================================
// FACILITY MANAGEMENT (ROOMS / TENTS)
// ==========================================
export async function getRooms() {
  const userId = await getUserId();
  return await db.room.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRoom(data: unknown) {
  try {
    const validated = roomSchema.parse(data);
    const userId = await getUserId();
    const room = await db.room.create({
      data: {
        name: validated.name,
        type: validated.type || "tent",
        userId,
        targetTempF: validated.targetTempF ?? null,
        targetRH: validated.targetRH ?? null,
        targetVPD: validated.targetVPD ?? null,
        lightOnTime: validated.lightOnTime ?? null,
        lightOffTime: validated.lightOffTime ?? null,
        ppfd: validated.ppfd ?? null,
        lightDistance: validated.lightDistance ?? null,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/rooms");
    return { success: true, room: serializePrisma(room) };
  } catch (error) {
    console.error("Failed to create room:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => e.message).join(", ") };
    }
    return { success: false, error: "Failed to create room." };
  }
}

export async function updateRoom(roomId: unknown, data: unknown) {
  try {
    const validatedRoomId = z.string().parse(roomId);
    const updateRoomSchema = roomSchema.partial();
    const validated = updateRoomSchema.parse(data);
    const userId = await getUserId();
    const room = await db.room.update({
      where: { id: validatedRoomId, userId },
      data: {
        name: validated.name,
        type: validated.type,
        targetTempF: validated.targetTempF,
        targetRH: validated.targetRH,
        targetVPD: validated.targetVPD,
        lightOnTime: validated.lightOnTime,
        lightOffTime: validated.lightOffTime,
        ppfd: validated.ppfd,
        lightDistance: validated.lightDistance,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/rooms");
    return { success: true, room: serializePrisma(room) };
  } catch (error) {
    console.error("Failed to update room:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => e.message).join(", ") };
    }
    return { success: false, error: "Failed to update room." };
  }
}

export async function deleteRoom(roomId: unknown) {
  try {
    const validatedRoomId = z.string().parse(roomId);
    const userId = await getUserId();
    
    // 1. Unassign all plants in this room (set roomId null)
    await db.plant.updateMany({
      where: { roomId: validatedRoomId, userId },
      data: { roomId: null },
    });
    
    // 2. Unassign all batches in this room (set roomId null)
    await db.batch.updateMany({
      where: { roomId: validatedRoomId, userId },
      data: { roomId: null },
    });
    
    // 3. Delete the room
    await db.room.delete({
      where: { id: validatedRoomId, userId },
    });
    
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/rooms");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete room:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => e.message).join(", ") };
    }
    return { success: false, error: "Failed to delete room." };
  }
}

export async function fetchRooms() {
  const userId = await getUserId();
  const rooms = await prisma.room.findMany({
    where: { userId },
    select: { id: true, name: true, type: true },
  });

  return serializePrisma(rooms);
}
