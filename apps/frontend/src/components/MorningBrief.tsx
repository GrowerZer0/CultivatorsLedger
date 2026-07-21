'use client';

import { useState } from "react";
import type { Plant, PlantInsight } from '@prisma/client';
import { generateDailyBriefing } from "@/app/actions";

interface MorningBriefProps {
  plant?: Plant | null;
  insight?: PlantInsight | null;
  onActionComplete?: () => void;
}

export function MorningBrief({ plant, insight: initialInsight, onActionComplete }: MorningBriefProps) {
  const [insight, setInsight] = useState<PlantInsight | null | undefined>(initialInsight);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper to safely convert Decimal/unknown to number
  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    return typeof val === 'number' ? val : Number(val);
  };

  const weightLoss = toNum(insight?.overnightWeightLoss);
  const vpdAvg = toNum(insight?.overnightVpdAvg);
  const moistureStart = toNum(insight?.overnightMoistureStart);
  const moistureEnd = toNum(insight?.overnightMoistureEnd);
  const currentWeight = plant ? toNum(plant.currentWeight) : 0;

  const handleRefresh = async () => {
    if (!plant?.id || isRefreshing) return;
    setIsRefreshing(true);

    try {
      const res = await generateDailyBriefing(plant.id, true);
      if (res.success && res.insight) {
        setInsight(res.insight);
      }
    } catch (err) {
      console.error("Failed to refresh insight:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format last updated time
  const rawDate = insight?.lastBriefingAt || insight?.createdAt || insight?.date;
  const lastUpdated = rawDate
    ? new Date(rawDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not yet generated';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Morning Brief
            </span>
            <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700">
              Updated {lastUpdated}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {plant?.name || 'Unknown Plant'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {plant?.strain || 'Active Cultivation'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : '🔄 Refresh AI'}
          </button>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {currentWeight.toFixed(1)} lbs
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Current Weight</p>
          </div>
        </div>
      </div>

      {/* Overnight Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Weight Loss</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {weightLoss.toFixed(1)} lbs
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Avg VPD</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {vpdAvg.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Moisture</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {moistureStart.toFixed(0)}% → {moistureEnd.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Recommendation</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
          {insight?.recommendationText || 'No recommendation available yet.'}
        </p>
        {insight?.actionPlan && (
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-2">
            {insight.actionPlan}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onActionComplete}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all"
        >
          ✓ Completed
        </button>
        <button
          onClick={() => {/* handle snooze */}}
          className="flex-1 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
        >
          Snooze
        </button>
      </div>
    </div>
  );
}