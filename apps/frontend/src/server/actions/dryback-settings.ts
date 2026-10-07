"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface DrybackSettings {
  seedling: number;
  veg: number;
  flowering: number;
  harvest: number;
}

export async function getDrybackSettings(): Promise<DrybackSettings> {
  const userId = await getUserId();
  if (!userId) {
    return { seedling: 5, veg: 6, flowering: 20, harvest: 25 };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      drybackStageSeedling: true,
      drybackStageVeg: true,
      drybackStageFlowering: true,
      drybackStageHarvest: true,
    },
  });

  return {
    seedling: user?.drybackStageSeedling ? Number(user.drybackStageSeedling) : 5,
    veg: user?.drybackStageVeg ? Number(user.drybackStageVeg) : 6,
    flowering: user?.drybackStageFlowering ? Number(user.drybackStageFlowering) : 20,
    harvest: user?.drybackStageHarvest ? Number(user.drybackStageHarvest) : 25,
  };
}

const settingsSchema = z.object({
  seedling: z.number().min(0).max(100),
  veg: z.number().min(0).max(100),
  flowering: z.number().min(0).max(100),
  harvest: z.number().min(0).max(100),
});

export async function updateDrybackSettings(data: unknown) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = settingsSchema.parse(data);

    await db.user.update({
      where: { id: userId },
      data: {
        drybackStageSeedling: validated.seedling,
        drybackStageVeg: validated.veg,
        drybackStageFlowering: validated.flowering,
        drybackStageHarvest: validated.harvest,
      },
    });

    revalidatePath("/settings/system");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("updateDrybackSettings error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "Invalid values" };
    }
    return { success: false, error: "Failed to save settings" };
  }
}