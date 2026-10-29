import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { notFound } from "next/navigation";
import { PlantDetailClient } from "./PlantDetailClient";
import type { DryBackLog, IrrigationEvent, PlantInsight } from "@/types/plant";
import { derivePlantStage } from "@/lib/plant-stage";
import { getPhotoUrls } from "@/server/actions/photos";
import { canAccessFeature } from "@/lib/features";
import { ExportButton } from "@/components/export/ExportButton";
import { SeedlingTracker } from "./SeedlingTracker";
import { getSeedlingContext } from "@/server/actions/seedling";
import { getLights } from "@/server/actions/lights";
import { serializePrisma } from "@/lib/serializePrisma";
import { getLatestClimateReading } from "@/server/actions/climate";

// Helper to convert Decimal to number
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function toNumberOrNull(value: any): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export default async function PlantDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const userId = await getUserId();
  const lights = await getLights();
  const plantData = await db.plant.findFirst({
    where: { id, userId },
    include: {
      light: true,
      dryBackLogs: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
      irrigationEvents: {
        orderBy: { timestamp: "desc" },
        take: 20,
      },
      room: true,
      batch: true,
      plantInsights: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      mirrorPlant: {
        select: { id: true, name: true },
      },
      photos: {
        orderBy: { capturedAt: "desc" }
      },
      stageEvents: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!plantData) {
    notFound();
  }
  const seedlingContext = await getSeedlingContext(id);
  const latestClimate = await getLatestClimateReading();
  const photoUrls = await getPhotoUrls(plantData.photos.map(photo => photo.storagePath));

  const derived = derivePlantStage({
    startDate: plantData.startDate,
    flipDate: plantData.flipDate,
    manualStage: plantData.stage,
  });
  // If the database stage is a lifecycle stage (harvest, dry, cure), use it.
  // Otherwise, fall back to the derived stage (veg, flower).
  const lifecycleStages = ["seedling", "harvest", "dry", "cure"];
  const finalStage = lifecycleStages.includes(plantData.stage?.toLowerCase() || "")
    ? plantData.stage
    : derived.stage;

  // Convert Decimal to number for client component with proper typing
  const plant = {
    id: plantData.id,
    name: plantData.name,
    strain: plantData.strain,
    roomId: plantData.roomId,
    batchId: plantData.batchId,
    wetWeight: toNumberOrNull(plantData.wetWeight),
    dryTarget: toNumberOrNull(plantData.dryTarget),
    currentWeight: toNumberOrNull(plantData.currentWeight),
    containerGallons: toNumberOrNull(plantData.containerGallons),
    notes: plantData.notes,
    startDate: plantData.startDate,
    userId: plantData.userId,
    createdAt: plantData.createdAt,
    updatedAt: plantData.updatedAt,
    mirrorPlantId: plantData.mirrorPlantId || null,
    mirrorPlant: plantData.mirrorPlant || null,
    room: plantData.room ? { id: plantData.room.id, name: plantData.room.name } : null,
    batch: plantData.batch ? { id: plantData.batch.id, name: plantData.batch.name } : null,
    stage: finalStage,
    flipDate: plantData.flipDate,
    pendingFcUpdate: plantData.pendingFcUpdate,
    pendingFcStartTime: plantData.pendingFcStartTime,
    dryBackLogs: plantData.dryBackLogs.map((log): DryBackLog => ({
      id: log.id,
      timestamp: log.timestamp,
      currentWeightLbs: toNumber(log.currentWeightLbs),
      dryBackPercent: toNumber(log.dryBackPercent),
      watered: log.watered,
      fed: log.fed,
      trainingEvent: log.trainingEvent,
      notes: log.notes,
      source: log.source || 'manual',
      plantId: log.plantId,
      batchId: log.batchId,
      containerGallons: toNumber(log.containerGallons),
      wetWeightLbs: toNumber(log.wetWeightLbs),
      dryTargetWeightLbs: toNumber(log.dryTargetWeightLbs),
      runoffEc: toNumberOrNull(log.runoffEc),
      unit: log.unit || 'lbs',
      createdAt: log.createdAt,
      userId: log.userId,
    })),
    irrigationEvents: plantData.irrigationEvents.map((event): IrrigationEvent => ({
      id: event.id,
      timestamp: event.timestamp,
      moisturePercentage: toNumberOrNull(event.moisturePercentage),
      notes: event.notes,
      roomId: event.roomId,
      zoneId: event.zoneId,
      sensorMac: event.sensorMac,
      ecLevel: toNumberOrNull(event.ecLevel),
      isManualEntry: event.isManualEntry,
      userId: event.userId,
      importId: event.importId,
      batchId: event.batchId,
      plantId: event.plantId,
      currentWeightLbs: toNumberOrNull(event.currentWeightLbs),
    })),
    plantInsights: plantData.plantInsights.map((insight): PlantInsight => ({
      id: insight.id,
      createdAt: insight.createdAt,
      date: insight.date,
      recommendationType: insight.recommendationType,
      recommendationText: insight.recommendationText,
      actionPlan: insight.actionPlan,
      plantId: insight.plantId,
      lastBriefingAt: insight.lastBriefingAt,
      overnightWeightLoss: toNumberOrNull(insight.overnightWeightLoss),
      overnightVpdAvg: toNumberOrNull(insight.overnightVpdAvg),
      overnightMoistureStart: toNumberOrNull(insight.overnightMoistureStart),
      overnightMoistureEnd: toNumberOrNull(insight.overnightMoistureEnd),
      outcome: insight.outcome,
      outcomeNotes: insight.outcomeNotes,
    })),
    stageEvents: plantData.stageEvents.map((event: any) => ({
      id: event.id,
      stage: event.stage,
      startedAt: event.startedAt.toISOString(),
    })),
    photos: plantData.photos.map((p) => ({
      id: p.id,
      url: photoUrls[p.storagePath] || null,
      note: p.note,
      stageAtCapture: p.stageAtCapture,
      weekOfStage: p.weekOfStage,
      weightAtCapture: p.weightAtCapture ? Number(p.weightAtCapture) : null,
      capturedAt: p.capturedAt.toISOString(),
    })),
    light: plantData.light ? {
      id: plantData.light.id,
      name: plantData.light.name,
      wattage: Number(plantData.light.wattage),
      dimmerPercent: Number(plantData.light.dimmerPercent),
      distanceInches: Number(plantData.light.distanceInches),
      scheduleHoursOn: Number(plantData.light.scheduleHoursOn),
    } : null,
  };
  const canExport = await canAccessFeature("export_csv");

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-end px-4 pt-4">
        <ExportButton mode="plant" plantId={plant.id} canExport={canExport} />
      </div>
      <PlantDetailClient 
      plant={serializePrisma(plant)} 
      seedlingContext={serializePrisma(seedlingContext)} 
      lights={serializePrisma(lights)}
      latestClimate={latestClimate} 
           />
    </div>
  );
}
