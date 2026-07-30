// apps/frontend/src/app/page.tsx
import Link from 'next/link';
import { DailyCheckIn } from '@/components/dashboard/DailyCheckIn';
import { getPlants } from '@/app/actions/plant-mgmt';
import { BarChart3, ChevronRight } from 'lucide-react';

export const revalidate = 0; // Fresh data on every load (Server Component segment config)

export default async function HomePage() {
  const plantsRaw = await getPlants();

  // Transform Prisma plants into the shape expected by DailyCheckIn
  const activePlants = plantsRaw.map((plant) => ({
    id: plant.id,
    name: plant.name,
  }));

  return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header / Navigation Quick Link */}
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

        {/* Primary Operational Loop Component */}
        <DailyCheckIn plants={activePlants} />
      </div>
  );
}