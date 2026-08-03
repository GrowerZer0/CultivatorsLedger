//src/app/(app)/batches/page.tsx
'"use client";'

import { getBatches } from "@/server/actions/batch-mgmt";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import { BatchesClient } from "@/app/(app)/batches/BatchesClient";

export default async function BatchesPage() {
  const [batches, rooms] = await Promise.all([
    getBatches(),
    fetchRooms(),
  ]);

  return <BatchesClient initialBatches={batches} rooms={rooms} />;
}