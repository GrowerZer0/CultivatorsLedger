"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { AddBatchModal } from "@/components/facility/AddBatchModal";
import type { Batch } from "@prisma/client";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type Room = { id: string; name: string };

interface BatchesClientProps {
  initialBatches: Batch[];
  rooms: Room[];
}

export function BatchesClient({ initialBatches, rooms }: BatchesClientProps) {
  const [batches, setBatches] = useState(initialBatches);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBatchCreated = useCallback(() => {
    // Re-fetch batches to update the list
    import("@/server/actions/batch-mgmt").then(({ getBatches }) => {
      getBatches().then((data) => setBatches(data));
    });
  }, []);

  if (batches.length === 0) {
  return (
    <>
      <EmptyState
        icon={Layers}
        title="No batches yet"
        description="Batches group plants from the same cultivar and start date — useful for comparing yields across grows."
        action={{
          label: "Create Your First Batch",
          onClick: () => setIsModalOpen(true),
        }}
        secondaryAction={{
          label: "Or skip batches and just add a plant →",
          href: "/plants",
        }}
      />
        <AddBatchModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          rooms={rooms}
          onBatchCreated={handleBatchCreated}
        />
    </>
  );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
            Batches
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Manage cultivation batches.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/batches/compare"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            Compare Batches
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-600/10 transition-colors"
          >
            New Batch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((batch) => (
          <Link
            key={batch.id}
            href={`/batches/${batch.id}`}
            className="block rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-emerald-500 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">{batch.name}</h3>
            {batch.cultivar && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{batch.cultivar}</p>
            )}
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              Started {new Date(batch.startDate).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>

      <AddBatchModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rooms={rooms}
        onBatchCreated={handleBatchCreated}
      />
    </div>
  );
}