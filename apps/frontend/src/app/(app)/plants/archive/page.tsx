import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

export default async function ArchivePage() {
  const userId = await getUserId();
  const archivedPlants = await db.plant.findMany({
    where: { userId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    include: { batch: true },
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/plants" className="p-2 hover:bg-zinc-100 rounded-lg">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">Archived Grows</h1>
      </div>

      {archivedPlants.length === 0 ? (
        <p className="text-zinc-500">No archived grows yet.</p>
      ) : (
        <div className="grid gap-4">
          {archivedPlants.map((plant) => (
            <div key={plant.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex justify-between items-center">
              <div>
                <h3 className="font-bold">{plant.name}</h3>
                <p className="text-xs text-zinc-500">
                  Archived on {new Date(plant.archivedAt!).toLocaleDateString()}
                </p>
              </div>
              <Link
                href={`/plants/${plant.id}/print`}
                target="_blank"
                className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-bold"
              >
                Print Report
              </Link>
              <Link href={`/plants/${plant.id}`} className="text-sm text-emerald-500 font-bold hover:underline">
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}