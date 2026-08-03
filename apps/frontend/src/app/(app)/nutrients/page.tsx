//apps/frontend/src/app/%28app%29/nutrients/page.tsx

"use client";

import { NutrientCalculator } from "@/components/nutrients/NutrientCalculator";

export default function NutrientsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 p-4">
      <div className="max-w-4xl mx-auto">
        <NutrientCalculator inline />
      </div>
    </div>
  );
}