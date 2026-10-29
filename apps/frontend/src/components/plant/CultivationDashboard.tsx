import { getEnvironmentTargets, getWeeklyActions, getFeedSchedule, type Stage } from "@/lib/cultivation-rules";
import { Droplet, Leaf, Sun, FlaskConical } from "lucide-react";

interface Props {
  stage: Stage;
  week: number;
  substrate: string;
  nutrientLine: string;
}

export function CultivationDashboard({ stage, week, substrate, nutrientLine }: Props) {
  const env = getEnvironmentTargets(stage);
  const actions = getWeeklyActions(stage, week);
  const feed = getFeedSchedule(substrate, nutrientLine, stage, week);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-500 flex items-center gap-2 capitalize">
            <Leaf className="size-5" /> {stage} · Week {week}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Based on {substrate.replace('_', ' ')} + {nutrientLine.replace('_', ' ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Environment */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/50">
          <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-1.5 mb-2">
            <Sun className="size-4" /> Environment
          </h3>
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>VPD:</strong> {env.vpdMin} - {env.vpdMax} kPa
          </p>
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>RH:</strong> ~{env.rhTarget}%
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-2 italic">
            {env.note}
          </p>
        </div>

        {/* Feed */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50">
          <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase flex items-center gap-1.5 mb-2">
            <FlaskConical className="size-4" /> Feed
          </h3>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {feed}
          </p>
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
          <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1.5 mb-2">
            <Droplet className="size-4" /> This Week's Actions
          </h3>
          <ul className="space-y-1">
            {actions.map((action, i) => (
              <li key={i} className="text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span> {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}