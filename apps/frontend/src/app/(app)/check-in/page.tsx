// src/app/(app)/check-in/page.tsx
import Link from 'next/link';
import { DailyCheckIn } from '@/components/dashboard/DailyCheckIn';
import { SinglePlantCheckIn } from '@/components/dashboard/SinglePlantCheckIn';
import { getPlants } from '@/server/actions/plant-mgmt';
import { fetchRooms } from '@/server/actions/facility-mgmt';
import { db } from '@/lib/db';
import { getUserId } from '@/lib/session';
import { notFound } from 'next/navigation';
import { BarChart3, ChevronRight } from 'lucide-react';
import { OnboardingReturnButton } from '@/components/onboarding/OnboardingReturnButton';

export const revalidate = 0;

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string; plantId?: string }>;
}) {
  const params = await searchParams;
  const roomId = params?.roomId;
  const plantId = params?.plantId;

  // ─── Single-plant mode ──────────────────────────────────────────
  if (plantId) {
    const userId = await getUserId();
    const raw = await db.plant.findFirst({
      where: { id: plantId, userId },
      include: {
        dryBackLogs: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: { sourceDevice: true, currentWeightLbs: true },
        },
      },
    });
    if (!raw) notFound();

    const plant = {
      id: raw.id,
      name: raw.name,
      strain: raw.strain,
      stage: raw.stage,
      wetWeight: raw.wetWeight ? Number(raw.wetWeight) : null,
      currentWeight: raw.dryBackLogs[0]
        ? Number(raw.dryBackLogs[0].currentWeightLbs)
        : raw.currentWeight
        ? Number(raw.currentWeight)
        : null,
      lastSourceDevice: raw.dryBackLogs[0]?.sourceDevice ?? null,
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-graphite dark:text-zinc-100">
              Log Reading
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Single-plant check-in with live dryback preview.
            </p>
          </div>
          <Link
            href="/check-in"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Log for a different plant
          </Link>
        </div>
        <SinglePlantCheckIn plant={plant} />
        <OnboardingReturnButton currentPage="check-in" />
      </div>
    );
  }

  // ─── Room-batch mode (unchanged) ────────────────────────────────
  const [plantsRaw, rooms] = await Promise.all([
    getPlants(),
    fetchRooms(),
  ]);

  const activePlants = plantsRaw.map((plant: any) => ({
    id: plant.id,
    name: plant.name,
    currentWeight: plant.currentWeight,
    strain: plant.strain,
    roomId: plant.roomId,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-graphite dark:text-zinc-100">
            Daily Operations
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Log today's metrics to update dryback trends.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold text-canopy dark:text-emerald-400 hover:underline transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          View Full Dashboard
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <DailyCheckIn
        plants={activePlants}
        rooms={rooms}
        defaultRoomId={roomId}
        defaultPlantId={plantId}
      />
      <OnboardingReturnButton currentPage="check-in" />
    </div>
  );
}