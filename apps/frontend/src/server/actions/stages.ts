"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function advancePlantStage(
  plantId: string, 
  newStage: string, 
  updateLight: boolean = false
) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      include: { light: true },
    });

    if (!plant) return { success: false, error: "Plant not found" };

    // 1. Close the current active stage event
    await db.stageEvent.updateMany({
      where: { plantId, endedAt: null },
      data: { endedAt: new Date() },
    });

    // 2. Create the new stage event
    await db.stageEvent.create({
      data: {
        plantId,
        userId,
        stage: newStage,
        notes: `Moved to ${newStage}`,
      },
    });

    // 3. Update the plant
    const updateData: any = { stage: newStage };
    
    // If moving to flower, log the flip date
    if (newStage === "flower") {
      updateData.flipDate = new Date();
    }

    await db.plant.update({
      where: { id: plantId },
      data: updateData,
    });

    // 4. Update the Light schedule if requested
    if (updateLight && plant.lightId) {
      let hours = 18;
      let intensity = 100;
      
      if (newStage === "flower") {
        hours = 12;
      } else if (newStage === "seedling") {
        hours = 18;
        intensity = 50; // Seedlings need less light
      }

      await db.light.update({
        where: { id: plant.lightId },
        data: {
          scheduleHoursOn: hours,
          dimmerPercent: intensity,
        },
      });
    }

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");
    revalidatePath("/plants");

    return { success: true };
  } catch (error) {
    console.error("advancePlantStage error:", error);
    return { success: false, error: "Failed to advance stage." };
  }
}