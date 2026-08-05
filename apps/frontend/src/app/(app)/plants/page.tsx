import { Suspense } from "react";
import { PlantsClient } from "./PlantsClient";
import { getPlants } from "@/server/actions/plant-mgmt";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import { fetchBatches } from "@/server/actions/batch-mgmt";

export default async function PlantsPage() {
  const [plants, rooms, batches] = await Promise.all([
    getPlants(),
    fetchRooms(),
    fetchBatches(),
  ]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Plants</h1>
          <p className="text-sm text-zinc-400">Manage all your plants across rooms and batches</p>
        </div>
      </div>

      <Suspense fallback={<div className="text-zinc-400">Loading plants...</div>}>
        <PlantsClient initialPlants={plants} rooms={rooms} batches={batches} />
      </Suspense>
    </div>
  );
}