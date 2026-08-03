"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { AddBatchModal } from "@/components/facility/AddBatchModal";
import type { Batch } from "@prisma/client";

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
          No batches yet.
        </h2>
        <p className="mt-2 text-gray-500 dark:text-zinc-400 max-w-md">
          Create your first grow batch to start tracking plants.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          Create Batch
        </button>
        <AddBatchModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          rooms={rooms}
          onBatchCreated={handleBatchCreated}
        />
      </div>
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
            Manage cultivation batches and compare harvest data.
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