import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import DashboardClient from "./DashboardClient";
import { getOnboardingState } from "@/server/actions/onboarding";
import { getPhotoUrls } from "@/server/actions/photos";

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
  photos: {
    orderBy: { capturedAt: "desc" },
    take: 1,
    select: { storagePath: true },
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

  const thumbPaths = plants
  .map((p) => p.photos[0]?.storagePath)
  .filter((p): p is string => !!p);
const thumbUrls = await getPhotoUrls(thumbPaths);

  const formattedPlants = plants.map(plant => ({
    id: plant.id,
    name: plant.name,
    strain: plant.strain,
  roomId: plant.roomId,
  batchId: plant.batchId,
  wetWeight: plant.wetWeight ? Number(plant.wetWeight) : null,
  dryTarget: plant.dryTarget ? Number(plant.dryTarget) : null,
  containerGallons: plant.containerGallons ? Number(plant.containerGallons) : null,
  stage: plant.stage,
  currentWeight: plant.dryBackLogs[0] ? Number(plant.dryBackLogs[0].currentWeightLbs) : null,
  thumbnailUrl: plant.photos[0]?.storagePath
    ? thumbUrls[plant.photos[0].storagePath] ?? null
    : null,
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
