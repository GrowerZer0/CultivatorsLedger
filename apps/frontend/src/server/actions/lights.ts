"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const lightSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  wattage: z.number().min(1),
  type: z.string().default("led_full_spectrum"),
  dimmerPercent: z.number().min(0).max(100),
  distanceInches: z.number().nullable(),
  scheduleHoursOn: z.number().min(1).max(24),
});

export async function saveLight(data: unknown) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    const validated = lightSchema.parse(data);

    const light = await db.light.upsert({
      where: { id: validated.id || "new-id" },
      create: {
        userId,
        name: validated.name,
        wattage: validated.wattage,
        type: validated.type,
        dimmerPercent: validated.dimmerPercent,
        distanceInches: validated.distanceInches,
        scheduleHoursOn: validated.scheduleHoursOn,
      },
      update: {
        name: validated.name,
        wattage: validated.wattage,
        dimmerPercent: validated.dimmerPercent,
        distanceInches: validated.distanceInches,
        scheduleHoursOn: validated.scheduleHoursOn,
      },
    });

    revalidatePath("/settings/hardware/lights");
    revalidatePath("/plants");
    revalidatePath("/dashboard");
    
    return { success: true, light };
  } catch (error) {
    console.error("saveLight error:", error);
    return { success: false, error: "Failed to save light." };
  }
}

export async function getLights() {
  const userId = await getUserId();
  if (!userId) return [];
  return db.light.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}