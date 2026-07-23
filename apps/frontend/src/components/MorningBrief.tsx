'use client';

import { useState } from "react"; // Keep useState for internal component state if needed, or remove if not.

interface MorningBriefProps {
  summary: string | null;
  lastBriefingTime: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function MorningBrief({ summary, lastBriefingTime, isRefreshing, onRefresh }: MorningBriefProps) {

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Facility Morning Brief
            </span>
            <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700">
              Updated {lastBriefingTime}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Daily Grow Operation Overview
          </h2>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-xs border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : '🔄 Refresh AI'}
          </button>
        </div>
      </div>

      {/* Briefing Summary */}
      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
        <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Facility Briefing:</h3>
        {isRefreshing ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400 animate-pulse">Generating briefing...</p>
        ) : summary ? (
          <div className="text-sm text-gray-900 dark:text-white prose dark:prose-invert">
            {/* Render markdown here if a library is added, otherwise just plain text */}
            <p className="whitespace-pre-wrap">{summary}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-zinc-400">No briefing available. Click refresh to generate.</p>
        )}
      </div>
    </div>
  );
}
