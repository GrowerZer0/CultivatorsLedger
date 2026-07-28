'use client';

interface MorningBriefProps {
  snapshot: string | null;
  attention: string[];
  actions: string[];
  lastBriefingTime: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function MorningBrief({ snapshot, attention, actions, lastBriefingTime, isRefreshing, onRefresh }: MorningBriefProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Facility Morning Brief</span>
            <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700">
              Updated {lastBriefingTime}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Daily Grow Operation Overview</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh AI'}
        </button>
      </div>

      {isRefreshing ? (
        <p className="text-sm text-gray-500 dark:text-zinc-400 animate-pulse">Generating briefing...</p>
        ) : snapshot ? (
          <div className="space-y-4">
            {actions.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40">
                <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Actions To Take Today</h3>
                <ol className="text-sm text-gray-900 dark:text-white list-decimal pl-5 space-y-1">
                  {actions.map((item, i) => <li key={i}>{item}</li>)}
                </ol>
              </div>
            )}

            {attention.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
                <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Attention Needed</h3>
                <ul className="text-sm text-gray-900 dark:text-white list-disc pl-5 space-y-1">
                  {attention.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
              <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Facility Snapshot</h3>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{snapshot}</p>
            </div>
          </div>
        ) : (
        <p className="text-sm text-gray-500 dark:text-zinc-400">No briefing available. Click refresh to generate.</p>
      )}
    </div>
  );
}