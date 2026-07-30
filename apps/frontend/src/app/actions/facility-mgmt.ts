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
export async function createRoom(data: { name: string; type?: string }) {
  try {
    const userId = await getUserId();
    const room = await db.room.create({
      data: {
        name: data.name,
        type: data.type || "tent",
        userId,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, room };
  } catch (error) {
    console.error("Failed to create room:", error);
    return { success: false, error: "Failed to create room." };
  }
}
export async function updateRoom(
  roomId: string,
  data: { name?: string; type?: string }
) {
  try {
    const userId = await getUserId();
    const room = await db.room.update({
      where: { id: roomId, userId },
      data,
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, room };
  } catch (error) {
    console.error("Failed to update room:", error);
    return { success: false, error: "Failed to update room." };
  }
}
export async function deleteRoom(roomId: string) {
  try {
    const userId = await getUserId();
    await db.room.delete({
      where: { id: roomId, userId },
    });
    revalidatePath("/settings");
    revalidatePath("/");
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