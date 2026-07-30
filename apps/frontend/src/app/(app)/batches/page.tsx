import Link from "next/link";

export default function BatchesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Batches
      </h1>

      <p className="text-zinc-500">
        Manage cultivation batches and compare harvest data.
      </p>

      <div className="flex gap-3">
        <Link
          href="/batches/compare"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
        >
          Compare Batches
        </Link>
      </div>
    </div>
  );
}