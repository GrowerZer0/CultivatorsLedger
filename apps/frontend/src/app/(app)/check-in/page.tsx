// apps/frontend/src/app/(app)/check-in/page.tsx
import Link from 'next/link';
import { DailyCheckIn } from '@/components/dashboard/DailyCheckIn';
import { getPlants } from '@/server/actions/plant-mgmt';
import { fetchRooms } from '@/server/actions/facility-mgmt';
import type { Plant } from '@prisma/client';
import { BarChart3, ChevronRight } from 'lucide-react';

export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const params = await searchParams;
  const roomId = params?.roomId;

  const [plantsRaw, rooms] = await Promise.all([
    getPlants(),
    fetchRooms(),
  ]);

  const activePlants = plantsRaw.map((plant: Plant) => ({
    id: plant.id,
    name: plant.name,
    currentWeight: plant.currentWeight,
    strain: plant.strain,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-graphite dark:text-zinc-100">Daily Operations</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Log today's metrics to update dryback trends.</p>
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
      <DailyCheckIn plants={activePlants} rooms={rooms} defaultRoomId={roomId} />
    </div>
  );
}