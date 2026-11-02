"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Load cells that are (a) active, (b) belong to this user, and (c) not yet
 * assigned to a plant. Used by StartGrowModal to populate the dropdown.
 */
export async function getAvailableLoadCells() {
  const userId = await getUserId();
  if (!userId) return [];
  const sensors = await db.sensorConfig.findMany({
    where: {
      userId,
      isActive: true,
      plantId: null,
    },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
  return sensors.filter((s) => /load|weight|scale|esp32/i.test(`${s.name} ${s.type}`));
}

/**
 * Assign a sensor (load cell) to a plant. Pass plantId=null to unassign.
 * Verifies both rows belong to the caller before touching anything.
 */
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
      data: { plantId },
    });

    revalidatePath("/dashboard");
    if (plantId) revalidatePath(`/plants/${plantId}`);
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