//src/app/(app)/batches/compare/page.tsx
"use client";
import dynamicImport from "next/dynamic";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
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
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Breadcrumbs
        segments={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Batches", href: "/batches" },
          { label: "Compare Batches", href: null },
        ]}
      />

  <BatchCompareContent />
    </div>
  );
}