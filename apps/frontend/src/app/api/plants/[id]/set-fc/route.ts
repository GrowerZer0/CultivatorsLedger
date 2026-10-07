import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getDrybackTargetForPlant, computeDryTarget } from "@/lib/dryback";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: plantId } = await params;
    const body = await request.json();
    const { weight: overrideWeight } = body;

    // Fetch plant + user
    const [plant, user] = await Promise.all([
      db.plant.findFirst({ where: { id: plantId, userId } }),
      db.user.findUnique({ where: { id: userId } }),
    ]);

    if (!plant) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine the wet weight to set
    let wetWeight: number;
    if (overrideWeight !== undefined && overrideWeight !== null && !isNaN(Number(overrideWeight))) {
      wetWeight = Number(overrideWeight);
    } else {
      // Use the latest ESP32 log for this plant
      const latestLog = await db.dryBackLog.findFirst({
        where: { plantId, userId },
        orderBy: { timestamp: "desc" },
      });
      if (!latestLog) {
        return NextResponse.json({ error: "No weight reading available. Pass weight explicitly." }, { status: 400 });
      }
      wetWeight = Number(latestLog.currentWeightLbs);
    }

    if (wetWeight <= 0) {
      return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
    }

    // Compute dryTarget from stage dryback %
    const target = getDrybackTargetForPlant(
      { stage: plant.stage, drybackOverride: plant.drybackOverride },
      user
    );
    const dryTarget = computeDryTarget(wetWeight, target.targetPercent);

    // Update plant
    const updated = await db.plant.update({
      where: { id: plantId },
      data: {
        wetWeight,
        dryTarget,
        currentWeight: wetWeight,
      },
    });

    // Write a fresh log marking the reset
    await db.dryBackLog.create({
      data: {
        timestamp: new Date(),
        currentWeightLbs: wetWeight,
        plantId,
        userId,
        source: 'manual',
        sourceDevice: 'Set FC (app)',
        containerGallons: Number(plant.containerGallons) || 3,
        wetWeightLbs: wetWeight,
        dryTargetWeightLbs: dryTarget,
        dryBackPercent: 0,
        unit: 'lbs',
        notes: `Set FC — WW=${wetWeight}lbs, dryTarget=${dryTarget}lbs (${target.targetPercent}% target from ${target.source})`,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/plants/${plantId}`);

    return NextResponse.json({
      success: true,
      plant: {
        id: updated.id,
        name: updated.name,
        wetWeight: Number(updated.wetWeight),
        dryTarget: Number(updated.dryTarget),
      },
      target,
    });
  } catch (error) {
    console.error("Set FC error:", error);
    return NextResponse.json({ error: "Failed to set FC" }, { status: 500 });
  }
}