import { getEnvironmentTargets, getWeeklyActions, getFeedSchedule, type Stage } from "@/lib/cultivation-rules";
import { Droplet, Leaf, Sun, FlaskConical, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  stage: Stage;
  week: number;
  substrate: string;
  nutrientLine: string;
  currentVpd?: number | null;
}

export function CultivationDashboard({ stage, week, substrate, nutrientLine, currentVpd }: Props) {
  const env = getEnvironmentTargets(stage);
  const actions = getWeeklyActions(stage, week);
  const feed = getFeedSchedule(substrate, nutrientLine, stage, week);

  // Determine if the current VPD is in range
  const isVpdInRange = currentVpd !== null && currentVpd !== undefined 
    ? (currentVpd >= env.vpdMin && currentVpd <= env.vpdMax)
    : null;

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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-1.5">
              <Sun className="size-4" /> Environment
            </h3>
            {isVpdInRange !== null && (
              isVpdInRange ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> In Range
                </span>
              ) : (
                <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="size-3" /> Out of Range
                </span>
              )
            )}
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Target VPD:</strong> {env.vpdMin} - {env.vpdMax} kPa
          </p>
          {currentVpd !== null && currentVpd !== undefined && (
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Current VPD:</strong> {currentVpd.toFixed(2)} kPa
            </p>
          )}
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

      {/* Actions (Not a checklist, just the facts) */}
      {actions.length > 0 && (
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5 mb-2">
            <Droplet className="size-4" /> This Week's Focus
          </h3>
          <ul className="space-y-1">
            {actions.map((action, i) => (
              <li key={i} className="text-sm text-zinc-900 dark:text-zinc-100 flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span> {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}