import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { notFound } from "next/navigation";
import { getPhotoUrls } from "@/server/actions/photos";
import { PrintTrigger } from "./PrintTrigger";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PlantPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getUserId();

  const plant = await db.plant.findFirst({
    where: { id, userId },
    include: {
      batch: true,
      room: true,
      light: true,
      dryBackLogs: { orderBy: { timestamp: "asc" } },
      irrigationEvents: { orderBy: { timestamp: "asc" } },
      photos: { orderBy: { capturedAt: "asc" } },
      stageEvents: { orderBy: { startedAt: "asc" } },
      cureEvents: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!plant) notFound();

  const photoUrls = await getPhotoUrls(plant.photos.map((p) => p.storagePath));

  const wetWeight = plant.wetWeight ? Number(plant.wetWeight) : null;
  const finalWeight =
    plant.dryBackLogs.length > 0
      ? Number(plant.dryBackLogs[plant.dryBackLogs.length - 1].currentWeightLbs)
      : null;
  const yieldPct =
    wetWeight && finalWeight
      ? ((finalWeight / wetWeight) * 100).toFixed(1)
      : null;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white text-zinc-900 print:p-0 print:max-w-none">
      <PrintTrigger />

      <div className="print:hidden mb-6">
        <Link
          href={`/plants/${id}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="size-4" />
          Back to plant
        </Link>
      </div>

      <header className="border-b-2 border-zinc-900 pb-4 mb-6">
        <h1 className="text-3xl font-bold">{plant.name}</h1>
        {plant.strain && (
          <p className="text-sm text-zinc-600 mt-1">{plant.strain}</p>
        )}
        <p className="text-xs text-zinc-500 mt-2">
          Grow report · Generated{" "}
          {new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      {/* Key facts */}
      <section className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6 text-sm">
        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500">Room</p>
          <p>{plant.room?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500">Batch</p>
          <p>{plant.batch?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500">Light</p>
          <p>
            {plant.light
              ? `${plant.light.name} · ${plant.light.wattage}W @ ${plant.light.dimmerPercent}%`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500">
            Container
          </p>
          <p>{plant.containerGallons ? `${Number(plant.containerGallons)} gal` : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500">
            Start Date
          </p>
          <p>{new Date(plant.startDate).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500">
            Current Stage
          </p>
          <p className="capitalize">{plant.stage ?? "—"}</p>
        </div>
      </section>

      {/* Yield */}
      {wetWeight !== null && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase border-b border-zinc-300 pb-1 mb-2">
            Yield
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500">
                Wet
              </p>
              <p className="text-lg font-bold">{wetWeight.toFixed(2)} lbs</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500">
                Final
              </p>
              <p className="text-lg font-bold">
                {finalWeight !== null ? `${finalWeight.toFixed(2)} lbs` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500">
                Yield %
              </p>
              <p className="text-lg font-bold">
                {yieldPct !== null ? `${yieldPct}%` : "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Stage history */}
      {plant.stageEvents.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase border-b border-zinc-300 pb-1 mb-2">
            Stage History
          </h2>
          <ul className="text-sm space-y-1">
            {plant.stageEvents.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span className="capitalize font-medium">{e.stage}</span>
                <span className="text-zinc-500">
                  {new Date(e.startedAt).toLocaleDateString()}
                  {e.endedAt && ` → ${new Date(e.endedAt).toLocaleDateString()}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dryback summary */}
      {plant.dryBackLogs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase border-b border-zinc-300 pb-1 mb-2">
            Dryback Readings ({plant.dryBackLogs.length})
          </h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="text-left py-1 font-bold">Date</th>
                <th className="text-right py-1 font-bold">Weight</th>
                <th className="text-right py-1 font-bold">Dryback</th>
              </tr>
            </thead>
            <tbody>
              {plant.dryBackLogs.slice(0, 30).map((log) => (
                <tr key={log.id} className="border-b border-zinc-100">
                  <td className="py-1">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {Number(log.currentWeightLbs).toFixed(2)} lbs
                  </td>
                  <td className="py-1 text-right font-mono">
                    {Number(log.dryBackPercent).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {plant.dryBackLogs.length > 30 && (
            <p className="text-[10px] text-zinc-500 mt-1">
              Showing first 30 of {plant.dryBackLogs.length} readings.
            </p>
          )}
        </section>
      )}

      {plant.cureEvents && plant.cureEvents.length > 0 && (
  <section className="mb-6">
    <h2 className="text-sm font-bold uppercase border-b border-zinc-300 pb-1 mb-2">
      Cure Events ({plant.cureEvents.length})
    </h2>
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-zinc-300">
          <th className="text-left py-1 font-bold">Date</th>
          <th className="text-left py-1 font-bold">Event</th>
          <th className="text-right py-1 font-bold">Duration</th>
        </tr>
      </thead>
      <tbody>
        {plant.cureEvents.slice(0, 50).map((e) => (
          <tr key={e.id} className="border-b border-zinc-100">
            <td className="py-1">
              {new Date(e.occurredAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </td>
            <td className="py-1 capitalize">{e.eventType.replace(/_/g, " ")}</td>
            <td className="py-1 text-right font-mono">
              {e.durationMins ? `${e.durationMins}m` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}

      {/* Photos */}
      {plant.photos.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase border-b border-zinc-300 pb-1 mb-2">
            Photos
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {plant.photos.slice(0, 9).map((p) => {
              const url = photoUrls[p.storagePath];
              if (!url) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={url}
                  alt={p.note ?? plant.name}
                  className="w-full aspect-square object-cover rounded"
                />
              );
            })}
          </div>
        </section>
      )}

      <footer className="mt-8 pt-4 border-t border-zinc-300 text-[10px] text-zinc-500 text-center">
        Generated by CultivatorsLedger
      </footer>
    </div>
  );
}