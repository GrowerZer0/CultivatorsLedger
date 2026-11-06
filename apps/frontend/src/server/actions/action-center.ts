"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getWateringStatus, getFeedSchedule } from "@/lib/cultivation-engine"; // Ensure you point to your merged file

export async function getActionCenterData() {
  const userId = await getUserId();
  if (!userId) return { items: [], activePlantCount: 0 };

  const plants = await db.plant.findMany({
    where: {
      userId,
      archivedAt: null,
      stage: { notIn: ["harvest", "dry", "cure"] },
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

    // Week: fall back to days since plant.startDate if no StageEvent
    let currentWeek: number;
    if (activeEvent) {
      const daysInStage =
        Math.floor(
          (Date.now() - new Date(activeEvent.startedAt).getTime()) / 86_400_000,
        ) + 1;
      currentWeek = Math.floor(daysInStage / 7) + 1;
    } else if (plant.startDate) {
      const daysSinceStart =
        Math.floor(
          (Date.now() - new Date(plant.startDate).getTime()) / 86_400_000,
        ) + 1;
      currentWeek = Math.floor(daysSinceStart / 7) + 1;
    } else {
      currentWeek = 1;
    }

    const dryback = latestLog ? Number(latestLog.dryBackPercent) : null;
    const waterStatus = getWateringStatus(dryback);

    if (!waterStatus.needsWater) continue;

    const feed = getFeedSchedule(
      plant.substrate || "happy_frog",
      plant.nutrientLine || "gh_flora",
      plant.stage as any,
      currentWeek,
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

  return {
    items: actionItems.sort((a, b) =>
      a.severity === "critical" ? -1 : 1,
    ),
    activePlantCount: plants.length,
  };
}