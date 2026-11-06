"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getAvailableLoadCells() {
  const userId = await getUserId();
  if (!userId) return [];
  
  return await db.sensorConfig.findMany({
    where: {
      userId,
      isActive: true,
      plantId: null,
      roomId: null,
      type: "esp32-loadcell",
    },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

export async function assignSensorToPlant(data: unknown) {
  try {
    const schema = z.object({
      sensorId: z.string(),
      plantId: z.string().nullable(),
    });
    const { sensorId, plantId } = schema.parse(data);
    const userId = await getUserId();
    if (!userId) return { success: false as const, error: "Unauthorized" };

    const sensor = await db.sensorConfig.findFirst({
      where: { id: sensorId, userId },
      select: { id: true },
    });
    if (!sensor) return { success: false as const, error: "Sensor not found." };

    if (plantId !== null) {
      const plant = await db.plant.findFirst({
        where: { id: plantId, userId },
        select: { id: true },
      });
      if (!plant) return { success: false as const, error: "Plant not found." };
    }

    await db.sensorConfig.update({
      where: { id: sensorId },
      data: { plantId, roomId: null },
    });

    revalidatePath("/dashboard");
    if (plantId) revalidatePath(`/plants/${plantId}`);
    revalidatePath("/settings/hardware");
    return { success: true as const };
  } catch (error) {
    console.error("assignSensorToPlant error:", error);
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues.map((i) => i.message).join(", "),
      };
    }
    return { success: false as const, error: "Failed to assign sensor." };
  }
}