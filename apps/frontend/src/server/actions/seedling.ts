"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

interface SeedlingCheckInput {
  plantId: string;
  plugWeightG: number;
  symptoms: string[];
  notes?: string;
}

export async function saveSeedlingCheck(data: SeedlingCheckInput) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    // Get the most recent check for this plant to see if we already have a saturated weight
    const lastCheck = await db.seedlingCheck.findFirst({
      where: { plantId: data.plantId, userId },
      orderBy: { checkedAt: "desc" },
    });

    const check = await db.seedlingCheck.create({
      data: {
        plantId: data.plantId,
        userId,
        plugWeightG: data.plugWeightG,
        saturatedWeightG: lastCheck?.saturatedWeightG || null, 
        symptoms: data.symptoms,
        notes: data.notes,
      },
    });

    revalidatePath(`/plants/${data.plantId}`);
    return { success: true, check };
  } catch (error) {
    console.error("saveSeedlingCheck error:", error);
    return { success: false, error: "Failed to save check." };
  }
}

// This runs on the server when the page loads to give the UI the latest context
export async function getSeedlingContext(plantId: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const lastCheck = await db.seedlingCheck.findFirst({
    where: { plantId, userId },
    orderBy: { checkedAt: "desc" },
  });

  // Fetch the plant to get its current light context
  const plant = await db.plant.findFirst({
    where: { id: plantId, userId },
    include: { light: true },
  });

  return { lastCheck, plant };
}