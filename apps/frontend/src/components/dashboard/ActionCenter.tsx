import Link from "next/link";
import { AlertTriangle, Droplet, ArrowRight } from "lucide-react";

interface ActionItem {
  plantId: string;
  plantName: string;
  stage: string;
  week: number;
  dryback: number | null;
  waterMessage: string;
  severity: string;
  feed: string;
}

export function ActionCenter({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-6 text-center">
        <h3 className="text-emerald-800 dark:text-emerald-300 font-bold text-lg">✅ All caught up</h3>
        <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1">
          No plants need water right now. Your garden is happy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Needs Your Attention
      </h2>
      
      <div className="grid gap-3">
        {items.map((item) => (
          <Link key={item.plantId} href={`/plants/${item.plantId}`}>
            <div className={`p-4 rounded-xl border flex items-start justify-between transition-colors ${
              item.severity === "critical" 
                ? "bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/50 dark:hover:bg-red-950/40" 
                : "bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50 dark:hover:bg-amber-950/40"
            }`}>
              <div className="flex items-start gap-3">
                {item.severity === "critical" ? (
                  <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <Droplet className="size-5 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`font-bold ${
                    item.severity === "critical" ? "text-red-900 dark:text-red-200" : "text-amber-900 dark:text-amber-200"
                  }`}>
                    {item.plantName} <span className="text-xs font-normal capitalize">({item.stage} Week {item.week})</span>
                  </h3>
                  <p className={`text-sm mt-1 font-semibold ${
                    item.severity === "critical" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
                  }`}>
                    {item.waterMessage}
                  </p>
                  <p className={`text-xs mt-1 ${
                    item.severity === "critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    <strong>Feed:</strong> {item.feed}
                  </p>
                </div>
              </div>
              <ArrowRight className={`size-5 ${
                item.severity === "critical" ? "text-red-400" : "text-amber-400"
              }`} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}