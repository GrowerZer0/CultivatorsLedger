"use client";

import dynamicImport from "next/dynamic";

export const dynamic = "force-dynamic";

const BatchCompareContent = dynamicImport(
  () => import("./CompareContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] text-zinc-400">
        Loading batch comparison...
      </div>
    ),
  }
);

export default function BatchComparePage() {
  return <BatchCompareContent />;
}