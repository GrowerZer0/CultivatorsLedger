//src/app/(app)/dashboard/DashboardWrapper.tsx
"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
const DashboardClient = dynamic(
  () => import("./DashboardClient"),
  { ssr: false }
);
export default function DashboardWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard…</div>}>
      <DashboardClient />
    </Suspense>
  );
}