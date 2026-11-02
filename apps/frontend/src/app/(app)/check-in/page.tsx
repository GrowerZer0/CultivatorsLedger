// src/app/(app)/check-in/page.tsx
import { SinglePlantCheckIn } from "@/components/dashboard/SinglePlantCheckIn";
import { PlantPicker } from "@/components/dashboard/PlantPicker";
import { BackLink } from "@/components/ui/BackLink";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { notFound } from "next/navigation";
import { getPhotoUrls } from "@/server/actions/photos";

export const revalidate = 0;

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string; returnTo?: string; via?: string }>;
}) {
  const params = await searchParams;
  const plantId = params?.plantId;
  const returnTo = params?.returnTo ?? "/dashboard";
  const viaPicker = params?.via === "picker";
  const userId = await getUserId();

  // ─── Single-plant mode ──────────────────────────────────────────
  if (plantId) {
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
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-4">
          {/* Always show a way back to the picker so they can change plants */}
          <BackLink
            href={`/check-in?returnTo=${encodeURIComponent(returnTo)}`}
            label="Back to plants"
          />
        </div>
        <SinglePlantCheckIn plant={plant} returnTo={returnTo} />
      </div>
    );
  }

  // ─── Picker mode ────────────────────────────────────────────────
  const plantsRaw = await db.plant.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      dryBackLogs: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { currentWeightLbs: true },
      },
      photos: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: { storagePath: true },
      },
    },
  });

  const thumbUrls = await getPhotoUrls(
    plantsRaw.map((p) => p.photos[0]?.storagePath).filter((s): s is string => !!s),
  );

  const plants = plantsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    strain: p.strain,
    stage: p.stage,
    wetWeight: p.wetWeight ? Number(p.wetWeight) : null,
    currentWeight: p.dryBackLogs[0]
      ? Number(p.dryBackLogs[0].currentWeightLbs)
      : p.currentWeight
        ? Number(p.currentWeight)
        : null,
    thumbnailUrl: p.photos[0]?.storagePath
      ? thumbUrls[p.photos[0].storagePath] ?? null
      : null,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <BackLink
        href={returnTo}
        label={returnTo === "/dashboard" ? "Back to dashboard" : "Back"}
      />
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Log a Reading
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pick a plant to log today's weight.
        </p>
      </div>
      <PlantPicker plants={plants} returnTo={returnTo} />
    </div>
  );
}