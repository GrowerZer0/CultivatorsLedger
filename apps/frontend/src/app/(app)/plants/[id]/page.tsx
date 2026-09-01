import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";

// Next.js 15 requires params to be awaited
export default async function PlantDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const userId = await getUserId();
  
  const plant = await db.plant.findFirst({
    where: { id, userId },
    include: {
      dryBackLogs: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
      room: true,
      batch: true,
    },
  });

  if (!plant) {
    notFound();
  }

  const latestLog = plant.dryBackLogs[0];
  const weight = latestLog ? Number(latestLog.currentWeightLbs) : null;
  const dryback = latestLog ? Number(latestLog.dryBackPercent) : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/plants" className="text-sm text-zinc-500 hover:text-zinc-700">
            ← Back to Plants
          </Link>
          <h1 className="text-3xl font-bold mt-2">{plant.name}</h1>
          {plant.strain && (
            <p className="text-zinc-600 dark:text-zinc-400">{plant.strain}</p>
          )}
        </div>
        <div className="text-right">
          {weight !== null && (
            <div className="text-2xl font-bold">{weight} lbs</div>
          )}
          {dryback !== null && (
            <div className={`text-sm ${dryback > 80 ? 'text-red-500' : dryback > 60 ? 'text-yellow-500' : 'text-green-500'}`}>
              Dryback: {dryback.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {plant.room && (
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Room: {plant.room.name}
          </div>
          {plant.batch && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Batch: {plant.batch.name}
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        {plant.dryBackLogs.length > 0 ? (
          <div className="space-y-3">
            {plant.dryBackLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 py-2">
                <div>
                  <div className="font-medium">{Number(log.currentWeightLbs)} lbs</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className={`text-sm ${Number(log.dryBackPercent) > 80 ? 'text-red-500' : Number(log.dryBackPercent) > 60 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {Number(log.dryBackPercent).toFixed(1)}% dryback
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">No activity logged yet.</p>
        )}
      </div>
    </div>
  );
}
