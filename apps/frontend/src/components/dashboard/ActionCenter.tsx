import Link from "next/link";
import { getWateringStatus, type Stage } from "@/lib/cultivation-rules";
import { AlertTriangle, CheckCircle2, Droplet } from "lucide-react";

interface ActionCenterPlant {
  id: string;
  name: string;
  stage: Stage;
  week: number;
  dryback: number | null;
}

export function ActionCenter({ plants }: { plants: ActionCenterPlant[] }) {
  if (plants.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Needs Your Attention
      </h2>
      
      {plants.map((plant) => {
        const water = getWateringStatus(plant.dryback);
        
        // Skip plants that don't need anything
        if (water.severity === "good") return null;

        return (
          <Link key={plant.id} href={`/plants/${plant.id}`}>
            <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
              water.severity === "critical" ? "bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/50 dark:hover:bg-red-950/40" :
              "bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50 dark:hover:bg-amber-950/40"
            }`}>
              <div className="flex items-center gap-3">
                {water.severity === "critical" ? (
                  <AlertTriangle className="size-5 text-red-500" />
                ) : (
                  <Droplet className="size-5 text-amber-500" />
                )}
                <div>
                  <h3 className={`font-bold ${
                    water.severity === "critical" ? "text-red-900 dark:text-red-200" : "text-amber-900 dark:text-amber-200"
                  }`}>
                    {plant.name}
                  </h3>
                  <p className={`text-xs ${
                    water.severity === "critical" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
                  }`}>
                    {plant.stage} Week {plant.week} · {water.message}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}