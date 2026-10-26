import { getLights } from "@/server/actions/lights";
import { LightSettingsForm } from "./LightSettingsForm";

export default async function LightsPage() {
  const lights = await getLights();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Lighting</h1>
        <p className="text-sm text-zinc-500">
          Track your light schedule, intensity, and hanging distance to help the app calculate stage suitability.
        </p>
      </div>
      <LightSettingsForm initialLights={lights} />
    </div>
  );
}