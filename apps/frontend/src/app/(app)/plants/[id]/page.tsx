import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { notFound } from "next/navigation";
import { PlantDetailClient } from "./PlantDetailClient";
import type { DryBackLog, IrrigationEvent, PlantInsight } from "@/types/plant";

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
  
  const plantData = await db.plant.findFirst({
    where: { id, userId },
    include: {
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
      // Include mirrorPlant relation
      mirrorPlant: {
        select: { id: true, name: true },
      },
    },
  });

  if (!plantData) {
    notFound();
  }

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
    stage: plantData.stage || null,
    mirrorPlantId: plantData.mirrorPlantId || null,
    mirrorPlant: plantData.mirrorPlant || null,
    room: plantData.room ? { id: plantData.room.id, name: plantData.room.name } : null,
    batch: plantData.batch ? { id: plantData.batch.id, name: plantData.batch.name } : null,
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
  };

  return <PlantDetailClient plant={plant} />;
}
