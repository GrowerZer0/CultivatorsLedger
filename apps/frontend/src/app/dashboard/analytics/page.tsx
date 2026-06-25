import { prisma } from '../../../lib/prisma';
import RunoffAnalyticsChart from '@/components/RunoffAnalyticsChart';
import { getRequiredUserId } from '@/lib/session';
import { parseGrowStage } from '@/lib/telemetry-clients';
import { ClimateLog } from '@prisma/client';

export const revalidate = 0;

async function getAnalyticsData() {
  const userId = await getRequiredUserId();
  
  // Fetch room configuration
  const room = await prisma.growRoom.findFirst({
    where: { user_id: userId },
    select: { stage: true }
  });

  // Fetch telemetry
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const packets = await prisma.telemetryPacket.findMany({
    where: { userId, recordedAt: { gte: twentyFourHoursAgo } },
    orderBy: { recordedAt: 'asc' },
  });

  return {
    cleanLogs: packets.map((p: ClimateLog) => ({
      id: p.id,
      runoff_ec: p.runoffEc ? Number(p.runoffEc) : 0,
      weight: p.mediaWeightLbs ? Number(p.mediaWeightLbs) : 0,
      loggedAt: p.recordedAt,
    })),
    stage: parseGrowStage(room?.stage)
  };
}

export default async function AnalyticsPage() {
  const { cleanLogs, stage } = await getAnalyticsData();

  return (
    <div className="min-h-screen bg-[#0B0F19] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Crop Intelligence</h1>
        <RunoffAnalyticsChart data={cleanLogs} stage={stage} />
      </div>
    </div>
  );
}