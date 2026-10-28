"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

interface HarvestData {
  wetWeightLbs: number;
  dryingMethod: string;
}

export async function advancePlantStage(
  plantId: string,
  newStage: string,
  updateLight: boolean = false,
  harvestData?: HarvestData
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
        notes: harvestData
          ? `Harvested. Wet Weight: ${harvestData.wetWeightLbs} lbs. Method: ${harvestData.dryingMethod}`
          : `Moved to ${newStage}`,
      },
    });

    // 3. Update the plant
    const updateData: any = { stage: newStage };

    if (newStage === "flowering") {
      updateData.flipDate = new Date();
    }

    if (newStage === "harvest" && harvestData) {
      updateData.currentWeight = harvestData.wetWeightLbs;
      updateData.wetWeight = harvestData.wetWeightLbs;
    }

    await db.plant.update({
      where: { id: plantId },
      data: updateData,
    });

    // 4. Update the Light schedule if requested
    if (updateLight && plant.lightId) {
      let hours = 18;
      let intensity = 100;

      if (newStage === "flowering") hours = 12;
      else if (newStage === "seedling") { hours = 18; intensity = 50; }
      else if (newStage === "harvest" || newStage === "dry") { intensity = 0; } // Turn off light for drying

      await db.light.update({
        where: { id: plant.lightId },
        data: { scheduleHoursOn: hours, dimmerPercent: intensity },
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
export async function revertPlantStage(plantId: string, newStage: string) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    const plant = await db.plant.findFirst({ where: { id: plantId, userId } });
    if (!plant) return { success: false, error: "Plant not found" };

    // PAY GATE LOGIC: If moving from harvest back to flower/veg, check plant limits
    const nonHarvestStages = ["seedling", "vegetative", "flowering"];
    if (["harvest", "dry", "cure"].includes(plant.stage || "") && nonHarvestStages.includes(newStage)) {
      const user = await db.user.findUnique({ where: { id: userId } });
      const activePlantsCount = await db.plant.count({
        where: { 
          userId, 
          stage: { in: nonHarvestStages } 
        }
      });

      const limit = user?.subscriptionTier === "GROWER" ? 999 : 3; // Adjust based on your tier logic
      if (activePlantsCount >= limit) {
        return { 
          success: false, 
          error: `Your ${user?.subscriptionTier} plan allows ${limit} active plants. Upgrade to revert this plant.` 
        };
      }
    }

    // Log the revert
    await db.stageEvent.updateMany({
      where: { plantId, endedAt: null },
      data: { endedAt: new Date() },
    });

    await db.stageEvent.create({
      data: {
        plantId,
        userId,
        stage: newStage,
        notes: `Reverted back to ${newStage}`,
      },
    });

    await db.plant.update({
      where: { id: plantId },
      data: { stage: newStage },
    });

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to revert stage." };
  }
}