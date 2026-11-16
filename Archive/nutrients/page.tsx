import { NutrientCalculator } from "@/components/nutrients/NutrientCalculator";
import { getUserProfile } from "@/server/actions/profile";

export default async function NutrientsPage() {
  const profile = await getUserProfile();
  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 p-4">
      <div className="max-w-4xl mx-auto">
        <NutrientCalculator
          inline
          defaultFeedLineId={profile?.activeFeedLine ?? null}
        />
      </div>
    </div>
  );
}