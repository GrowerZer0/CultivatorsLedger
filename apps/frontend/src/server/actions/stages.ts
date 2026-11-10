"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// Coeff for target dry weight as a fraction of wet weight.
// 0.22 == 78% target dry-back (weight lost during dry phase).
const DRY_TARGET_COEFF = 0.22;

const STAGE_ORDER = ["seedling", "vegetative", "flowering", "dry", "cure", "archived"] as const;
type Stage = (typeof STAGE_ORDER)[number];

// Stages that "occupy" a plant slot for subscription gating.
const ACTIVE_STAGES: readonly Stage[] = ["seedling", "vegetative", "flowering"];

// Stages that represent post-harvest lifecycle.
const POST_HARVEST_STAGES: readonly Stage[] = ["dry", "cure"];

interface HarvestData {
  wetWeightLbs: number;
  dryingMethod: string;
}
interface LightOverride {
  scheduleHoursOn?: number;
  dimmerPercent?: number;
  distanceInches?: number | null;
}

function isValidStage(value: string): value is Stage {
  return (STAGE_ORDER as readonly string[]).includes(value);
}

export async function advancePlantStage(
  plantId: string,
  newStage: string,
  updateLight: boolean = false,
  harvestData?: HarvestData,
  lightOverride?: LightOverride,
) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    if (!isValidStage(newStage)) {
      return { success: false, error: `Invalid stage: ${newStage}` };
    }

    // Transitioning into dry REQUIRES harvest data. Bail before any writes.
    if (newStage === "dry") {
      if (
        !harvestData ||
        typeof harvestData.wetWeightLbs !== "number" ||
        !Number.isFinite(harvestData.wetWeightLbs) ||
        harvestData.wetWeightLbs <= 0
      ) {
        return {
          success: false,
          error: "Wet weight is required to start the dry phase.",
        };
      }
      if (!harvestData.dryingMethod) {
        return {
          success: false,
          error: "Drying method is required to start the dry phase.",
        };
      }
    }

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      include: { light: true, batch: true },
    });

    if (!plant) return { success: false, error: "Plant not found" };

    const wetWeight = harvestData?.wetWeightLbs ?? 0;
    const dryTarget =
      newStage === "dry"
        ? Number((wetWeight * DRY_TARGET_COEFF).toFixed(2))
        : null;

    const now = new Date();

    await db.$transaction(async (tx) => {
      // 1. Close the current active stage event.
      await tx.stageEvent.updateMany({
        where: { plantId, endedAt: null },
        data: { endedAt: now },
      });

      // 2. Open the new stage event.
      await tx.stageEvent.create({
        data: {
          plantId,
          userId,
          stage: newStage,
          startedAt: now,
          notes:
            newStage === "dry" && harvestData
              ? `Harvested. Wet Weight: ${harvestData.wetWeightLbs} lbs. Target dry: ${dryTarget} lbs. Method: ${harvestData.dryingMethod}`
              : `Moved to ${newStage}`,
        },
      });

      // 3. Update the plant.
      const plantUpdate: Prisma.PlantUpdateInput = {
        stage: newStage,
      };

      if (newStage === "flowering") {
        plantUpdate.flipDate = now;
      }

      if (newStage === "dry" && harvestData && dryTarget !== null) {
        plantUpdate.wetWeight = new Prisma.Decimal(wetWeight);
        plantUpdate.dryTarget = new Prisma.Decimal(dryTarget);
        plantUpdate.currentWeight = new Prisma.Decimal(wetWeight);
        plantUpdate.dryingMethod = harvestData.dryingMethod;

        // 3a. Seed the first DryBackLog so the tracker isn't empty on day 1.
        // Uses the same calculation path as calculateDryBack(): currentDrop is
        // (wet - current) = 0 at harvest, so dryBackPercent = 0.
        await tx.dryBackLog.create({
          data: {
            userId,
            plantId,
            batchId: plant.batchId ?? null,
            containerGallons: plant.containerGallons ?? new Prisma.Decimal(0),
            wetWeightLbs: new Prisma.Decimal(wetWeight),
            dryTargetWeightLbs: new Prisma.Decimal(dryTarget),
            currentWeightLbs: new Prisma.Decimal(wetWeight),
            dryBackPercent: new Prisma.Decimal(0),
            source: "harvest-seed",
            watered: false,
            fed: false,
            notes: `Harvest seed weight. Drying method: ${harvestData.dryingMethod}`,
          },
        });
      }

      await tx.plant.update({
        where: { id: plantId },
        data: plantUpdate,
      });

// 4. Light schedule.
if (updateLight && plant.lightId) {
  let hours = plant.light?.scheduleHoursOn ?? 18;
  let intensity = 100;
  let distance: number | null | undefined = undefined;

  if (lightOverride) {
    // Caller provided explicit values — use them.
    if (lightOverride.scheduleHoursOn !== undefined) hours = lightOverride.scheduleHoursOn;
    if (lightOverride.dimmerPercent !== undefined) intensity = lightOverride.dimmerPercent;
    if (lightOverride.distanceInches !== undefined) distance = lightOverride.distanceInches;
  } else {
    // Fall back to defaults (unchanged from before).
    if (newStage === "seedling") {
      hours = 18;
      intensity = 50;
    } else if (newStage === "vegetative") {
      hours = 18;
      intensity = 100;
    } else if (newStage === "flowering") {
      hours = 12;
      intensity = 100;
    } else if (newStage === "dry" || newStage === "cure") {
      intensity = 0;
    }
  }

  const lightUpdate: Prisma.LightUpdateInput = {
    scheduleHoursOn: hours,
    dimmerPercent: intensity,
  };
  if (distance !== undefined) lightUpdate.distanceInches = distance;

  await tx.light.update({
    where: { id: plant.lightId },
    data: lightUpdate,
  });
}
  });

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

    if (!isValidStage(newStage)) {
      return { success: false, error: `Invalid stage: ${newStage}` };
    }

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
    });
    if (!plant) return { success: false, error: "Plant not found" };

    const currentStage = (plant.stage ?? "").toLowerCase() as Stage | "";
    if (currentStage === newStage) {
      return { success: false, error: `Plant is already in ${newStage}.` };
    }

    // Pay-gate: only enforce when re-entering an "active" stage from post-harvest.
    const leavingPostHarvest = POST_HARVEST_STAGES.includes(currentStage as Stage);
    const enteringActive = ACTIVE_STAGES.includes(newStage as Stage);
    if (leavingPostHarvest && enteringActive) {
      const user = await db.user.findUnique({ where: { id: userId } });
      const activePlantsCount = await db.plant.count({
        where: { userId, stage: { in: ACTIVE_STAGES as unknown as string[] } },
      });
      const limit = user?.subscriptionTier === "GROWER" ? 999 : 3;
      // This plant is currently in a post-harvest stage, so it is NOT counted
      // in activePlantsCount. Reverting will make it active — require room for it.
      if (activePlantsCount >= limit) {
        return {
          success: false,
          error: `Your ${user?.subscriptionTier ?? "FREE"} plan allows ${limit} active plants. Upgrade to revert this plant.`,
        };
      }
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      // 1. Close current active stage event.
      await tx.stageEvent.updateMany({
        where: { plantId, endedAt: null },
        data: { endedAt: now },
      });

      // 2. Open the reverted stage event.
      await tx.stageEvent.create({
        data: {
          plantId,
          userId,
          stage: newStage,
          startedAt: now,
          notes: `Reverted back to ${newStage}`,
        },
      });

      // 3. Update the plant, clearing stage-specific state that no longer applies.
      const plantUpdate: Prisma.PlantUpdateInput = {
        stage: newStage,
      };

      // flipDate only meaningful in flowering.
      if (newStage !== "flowering") {
        plantUpdate.flipDate = null;
      }

      // Dry-phase fields only meaningful in dry/cure.
      if (newStage !== "dry" && newStage !== "cure") {
        plantUpdate.wetWeight = null;
        plantUpdate.dryTarget = null;
        plantUpdate.dryingMethod = null;
        // currentWeight is only meaningful during dry/cure; null it so the
        // plant card doesn't show a stale harvest weight during veg.
        plantUpdate.currentWeight = null;
      }

      await tx.plant.update({
        where: { id: plantId },
        data: plantUpdate,
      });

      // 4. Delete the seeded DryBackLog when leaving the post-harvest window.
      // Any manually-logged dry weights during dry/cure are left intact so
      // the user can review them — but the auto-seeded harvest entry (which
      // has no useful biological meaning outside the dry phase) is removed.
      if (newStage !== "dry" && newStage !== "cure") {
        await tx.dryBackLog.deleteMany({
          where: { plantId, source: "harvest-seed" },
        });
      }
    });

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");
    revalidatePath("/plants");

    return { success: true };
  } catch (error) {
    console.error("revertPlantStage error:", error);
    return { success: false, error: "Failed to revert stage." };
  }
}