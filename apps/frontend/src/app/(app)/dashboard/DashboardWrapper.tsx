import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import DashboardClient from "./DashboardClient";
import { getOnboardingState } from "@/server/actions/onboarding";

export default async function DashboardWrapper() {
  const userId = await getUserId();
  
  const [plants, recentLogs, onboardingState] = await Promise.all([
    db.plant.findMany({
      where: { userId },
      include: {
        dryBackLogs: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    }),
    db.dryBackLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
    getOnboardingState(userId),
  ]);

  const formattedPlants = plants.map(plant => ({
    id: plant.id,
    name: plant.name,
    strain: plant.strain,
    currentWeight: plant.dryBackLogs[0] ? Number(plant.dryBackLogs[0].currentWeightLbs) : null,
  }));

  const alerts = plants
    .map(plant => {
      const log = plant.dryBackLogs[0];
      if (!log) return null;
      const dryback = Number(log.dryBackPercent);
      if (dryback > 80) return `${plant.name} needs irrigation (${dryback.toFixed(1)}% dryback)`;
      return null;
    })
    .filter(Boolean) as string[];

  const formattedLogs = recentLogs.map(log => ({
    id: log.id,
    description: `Weight: ${Number(log.currentWeightLbs)} lbs (${Number(log.dryBackPercent).toFixed(1)}% dryback)`,
    timestamp: log.timestamp,
  }));

  const isOnboardingActive = !onboardingState.completed && !onboardingState.dismissed;

  return (
    <DashboardClient 
      initialData={{
        plants: formattedPlants,
        recentLogs: formattedLogs,
        alerts,
        summary: `${plants.length} plants, ${recentLogs.length} recent logs`,
      }} 
      onboardingState={onboardingState}
      isOnboardingActive={isOnboardingActive}
    />
  );
}
