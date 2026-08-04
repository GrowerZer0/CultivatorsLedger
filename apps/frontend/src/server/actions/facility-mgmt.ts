//src/server/actions/batch-mgmt.ts
"use server";
import { db, prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { serializePrisma } from "@/lib/serializePrisma";

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
export async function createRoom(data: { 
  name: string;
  type?: string;
  targetTempF?: number;
  targetRH?: number;
  targetVPD?: number;
  lightOnTime?: string;
  lightOffTime?: string;
  ppfd?: number;
  lightDistance?: number;
}) {
  try {
    const userId = await getUserId();
    const room = await db.room.create({
      data: {
        name: data.name,
        type: data.type || "tent",
        userId,
        targetTempF: data.targetTempF ?? null,
        targetRH: data.targetRH ?? null,
        targetVPD: data.targetVPD ?? null,
        lightOnTime: data.lightOnTime ?? null,
        lightOffTime: data.lightOffTime ?? null,
        ppfd: data.ppfd ?? null,
        lightDistance: data.lightDistance ?? null,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/rooms");
    return { success: true, room };
  } catch (error) {
    console.error("Failed to create room:", error);
    return { success: false, error: "Failed to create room." };
  }
}
export async function updateRoom(
  roomId: string,
  data: {
    name?: string;
    type?: string;
    targetTempF?: number | null;
    targetRH?: number | null;
    targetVPD?: number | null;
    lightOnTime?: string | null;
    lightOffTime?: string | null;
    ppfd?: number | null;
    lightDistance?: number | null;
  }
) {
  try {
    const userId = await getUserId();
    const room = await db.room.update({
      where: { id: roomId, userId },
      data,
    });
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/rooms");
    return { success: true, room };
  } catch (error) {
    console.error("Failed to update room:", error);
    return { success: false, error: "Failed to update room." };
  }
}
export async function deleteRoom(roomId: string) {
  try {
    const userId = await getUserId();
    
    // 1. Unassign all plants in this room (set roomId null)
    await db.plant.updateMany({
      where: { roomId, userId },
      data: { roomId: null },
    });
    
    // 2. Unassign all batches in this room (set roomId null)
    await db.batch.updateMany({
      where: { roomId, userId },
      data: { roomId: null },
    });
    
    // 3. Delete the room
    await db.room.delete({
      where: { id: roomId, userId },
    });
    
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/rooms");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete room:", error);
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