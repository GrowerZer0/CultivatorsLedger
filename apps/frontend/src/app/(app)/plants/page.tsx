import { Suspense } from "react";
import { PlantsClient } from "./PlantsClient";
import { getPlants } from "@/server/actions/plant-mgmt";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchBatches } from "@/server/actions/batch-mgmt";
import { OnboardingReturnButton } from "@/components/onboarding/OnboardingReturnButton";
import { getPhotoUrls } from "@/server/actions/photos";
import { ExportButton } from "@/components/export/ExportButton";
import { canAccessFeature } from "@/lib/features";

export default async function PlantsPage() {
  const [plants, rooms, batches, canExport] = await Promise.all([
    getPlants(),
    fetchRooms(),
    fetchBatches(),
    canAccessFeature("export_csv"),
  ]);

  const paths = (plants as any[])
    .map((p) => p.thumbnailPath)
    .filter((p): p is string => !!p);

  const urlByPath = await getPhotoUrls(paths);

  const plantsWithThumbs = (plants as any[]).map((p) => ({
    ...p,
    thumbnailUrl: p.thumbnailPath ? urlByPath[p.thumbnailPath] ?? null : null,
  }));

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Plants</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage all your plants across rooms and batches</p>
        </div>
      </div>
      <ExportButton mode="all" canExport={canExport} />

      <Suspense fallback={<div className="text-zinc-600 dark:text-zinc-400">Loading plants...</div>}>
        <PlantsClient initialPlants={plantsWithThumbs} rooms={rooms} batches={batches} />
      </Suspense>

      <OnboardingReturnButton currentPage="plants" />
    </div>
  );
}