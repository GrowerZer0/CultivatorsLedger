"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getWateringStatus, getFeedSchedule } from "@/lib/cultivation-engine"; // Ensure you point to your merged file

export async function getActionCenterData() {
  const userId = await getUserId();
  if (!userId) return [];

  const plants = await db.plant.findMany({
    where: { 
      userId,
      // Only show plants that are actively growing (not harvested)
      stage: { notIn: ["harvest", "dry", "cure"] }
    },
    include: {
      dryBackLogs: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
      stageEvents: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  const actionItems = [];

  for (const plant of plants) {
    const latestLog = plant.dryBackLogs[0];
    const activeEvent = plant.stageEvents[0];
    
    if (!activeEvent) continue; // Skip if no active stage is tracked

    // 1. Calculate current week based on the active StageEvent
    const daysInStage = Math.floor((Date.now() - new Date(activeEvent.startedAt).getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.floor(daysInStage / 7) + 1;

    // 2. Get the dryback percentage
    const dryback = latestLog ? Number(latestLog.dryBackPercent) : null;

    // 3. Run the rules engine
    const waterStatus = getWateringStatus(dryback);
    
    // 4. If it doesn't need water, we don't put it in the Action Center (for now)
    if (!waterStatus.needsWater) continue;

    const feed = getFeedSchedule(
      plant.substrate || "happy_frog", 
      plant.nutrientLine || "gh_flora", 
      plant.stage as any, 
      currentWeek
    );

    actionItems.push({
      plantId: plant.id,
      plantName: plant.name,
      stage: plant.stage,
      week: currentWeek,
      dryback,
      waterMessage: waterStatus.message,
      severity: waterStatus.severity,
      feed,
    });
  }

  // Sort by severity (critical first)
  return actionItems.sort((a, b) => (a.severity === "critical" ? -1 : 1));
}