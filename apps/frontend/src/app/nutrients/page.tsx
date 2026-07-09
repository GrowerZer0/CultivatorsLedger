'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Droplets,
  Sprout,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useTheme } from 'next-themes';
import {
  calculateReservoirDelta,
  commercialFeedSchedules,
  type FeedSchedule,
  type NutrientDose,
} from '@/lib/cultivation';
import { getCustomBlueprints } from '@/app/actions';

// --------------------------------------------
// DarkNumberField component
// --------------------------------------------
type DarkNumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function DarkNumberField({ label, value, onChange }: DarkNumberFieldProps) {
  return (
    <label className="grid gap-1 text-xs font-bold text-gray-500 dark:text-zinc-400 tracking-wide">
      {label}
      <input
        className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
        min={0}
        step="0.05"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

// --------------------------------------------
// Main Nutrients Page
// --------------------------------------------
export default function NutrientsPage() {
  const { theme, setTheme } = useTheme();

  // State for feeding calculator
  const [customBlueprints, setCustomBlueprints] = useState<any[]>([]);
  const [activeLineId, setActiveLineId] = useState('ff-trio');
  const [reservoirGallons, setReservoirGallons] = useState(40);
  const [leftoverGallons, setLeftoverGallons] = useState(11.5);
  const [currentEc, setCurrentEc] = useState(1.4);
  const [isSensorDriven, setIsSensorDriven] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load custom blueprints (nutrient recipes)
  const loadBlueprints = useCallback(async () => {
    setLoading(true);
    try {
      const blueprints = await getCustomBlueprints();
      setCustomBlueprints(blueprints || []);
    } catch (err) {
      console.error('Failed to load nutrient blueprints:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlueprints();
  }, [loadBlueprints]);

  // Merge commercial + custom schedules
  const combinedSchedules = useMemo<FeedSchedule[]>(() => {
    const baseMerged = commercialFeedSchedules.map(s => {
      const match = customBlueprints.find(cb => cb.id === s.id);
      return match ? {
        ...s,
        id: match.id,
        brand: match.brand,
        stage: match.stage,
        targetEc: match.target_ec,
        doses: match.doses_json as NutrientDose[],
      } : s;
    });

    const completelyNewCustom = customBlueprints
      .filter(cb => !commercialFeedSchedules.find(s => s.id === cb.id))
      .map(cb => ({
        id: cb.id,
        brand: cb.brand,
        label: cb.brand,
        stage: cb.stage,
        targetEc: cb.target_ec,
        targetPh: 5.8,
        doses: cb.doses_json as NutrientDose[],
      }));

    return [...baseMerged, ...completelyNewCustom];
  }, [customBlueprints]);

  // Active schedule
  const activeSchedule = useMemo<FeedSchedule>(() => {
    return combinedSchedules.find((s) => s.id === activeLineId) || combinedSchedules[0] || commercialFeedSchedules[0];
  }, [activeLineId, combinedSchedules]);

  // For the effective EC (we'll use currentEc directly here, or allow manual override)
  // In the original, effectiveEc is derived from sensor or manual – we'll just use currentEc for now.
  const effectiveEc = currentEc; // you can later add sensor integration

  // Reservoir delta calculation
  const reservoirDelta = useMemo(() => {
    return calculateReservoirDelta({
      reservoirGallons,
      leftoverGallons,
      doses: activeSchedule.doses,
      currentEc: effectiveEc,
      targetEc: activeSchedule.targetEc,
    });
  }, [activeSchedule.doses, activeSchedule.targetEc, effectiveEc, reservoirGallons, leftoverGallons]);

  // Reset to defaults
  const handleResetFeeding = () => {
    setReservoirGallons(40);
    setLeftoverGallons(11.5);
    setCurrentEc(1.4);
  };

  // Show loading while blueprints load
  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center text-sm font-semibold text-gray-500 dark:text-zinc-400 animate-pulse">
          Loading nutrient recipes...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4">
        {/* Header with theme toggle and settings */}
        <header className="flex items-center justify-end gap-2 border-b border-gray-200 dark:border-zinc-800 pb-4 mb-6">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link href="/settings">
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800">
              <Settings size={20} />
            </button>
          </Link>
        </header>

        {/* Feeding Calculator */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl">
          {/* Header with Brand Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Droplets className="size-4 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dynamic Reservoir Dosing</h3>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                  Top off system reservoirs while maintaining targeted chemical balances.
                </p>
              </div>
            </div>

            {/* Brand Schedule Selector */}
            <select
              value={activeLineId}
              onChange={(e) => setActiveLineId(e.target.value)}
              className="text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 p-2 outline-none text-gray-800 dark:text-zinc-200 cursor-pointer focus:border-cyan-500 transition-all shadow-inner"
            >
              {combinedSchedules.map((s) => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
                  {s.brand} {s.stage ? `(${s.stage})` : ''}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button
                type="button"
                onClick={handleResetFeeding}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-300 transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <DarkNumberField
              label="Tank Capacity (Gal)"
              value={reservoirGallons}
              onChange={setReservoirGallons}
            />
            <DarkNumberField
              label="Current Backlog Vol (Gal)"
              value={leftoverGallons}
              onChange={setLeftoverGallons}
            />
            <div className="grid gap-1">
              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tracking-wide">
                Current Solution EC
              </span>
              <input
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-40 disabled:bg-white dark:bg-zinc-900 transition-all"
                type="number"
                step="0.05"
                value={effectiveEc}
                onChange={(e) => setCurrentEc(Number(e.target.value))}
                disabled={isSensorDriven}
              />
              {isSensorDriven && (
                <span className="text-[9px] text-emerald-400 font-bold tracking-wider mt-0.5">
                  LOCKED TO SENSOR
                </span>
              )}
            </div>
          </div>

          {/* Nutrient Breakdown */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {activeSchedule.doses.map((dose: NutrientDose, index: number) => (
              <div
                key={`${dose.product}-${index}`}
                className={`grid gap-3 grid-cols-[1fr_80px_90px] items-center rounded-lg px-3 py-2 text-xs ${
                  index % 2 === 0
                    ? 'bg-gray-50/50 dark:bg-zinc-800/30'
                    : 'bg-transparent'
                }`}
              >
                <div className="font-medium text-gray-700 dark:text-zinc-300 truncate">
                  {dose.product}
                </div>
                <div className="text-center font-mono text-gray-500 dark:text-zinc-400">
                  {dose.mlPerGallon} mL/g
                </div>
                <div
                  className={`text-center font-black font-mono transition-all ${
                    reservoirDelta.isCriticalClamp
                      ? 'text-red-400'
                      : 'text-orange-400'
                  }`}
                >
                  {reservoirDelta.nutrientsToAdd[index]?.totalMl ?? 0} mL
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-gray-400 dark:text-zinc-400 italic">
            Adjust ml/gallon values in <span className="font-medium">Settings → Nutrient Feed Library</span>
          </p>

          {/* Footer: Dynamic Output Targets */}
          <div
            className={`mt-4 rounded-xl border p-4 transition-all ${
              reservoirDelta.isCriticalClamp
                ? 'bg-red-950/20 border-red-900/60'
                : 'border-gray-200 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-950/30'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                reservoirDelta.isCriticalClamp ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              <Sprout className="size-4" />
              Dynamic Output Targets • {activeSchedule.brand} ({activeSchedule.stage})
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-zinc-300 font-medium">
              {effectiveEc === 0 ? (
                <>
                  <span className="text-gray-900 dark:text-white font-bold">Standard Delivery:</span> Mix base concentrates into fresh top‑off water to achieve{' '}
                  <span className="font-extrabold text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-950 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-800">
                    {activeSchedule.targetEc} EC
                  </span>
                  .
                </>
              ) : (
                <>
                  Target base blueprint: <span className="text-gray-900 dark:text-white font-bold">{activeSchedule.targetEc} EC</span>. Accounting for residual solution (
                  <span className="text-gray-900 dark:text-white font-mono font-bold">{effectiveEc} EC</span>), blend top‑off to{' '}
                  <span
                    className={`font-black font-mono bg-gray-50 dark:bg-zinc-950 px-1.5 py-0.5 rounded border ${
                      reservoirDelta.isCriticalClamp
                        ? 'text-red-400 border-red-900'
                        : 'text-orange-400 border-gray-200 dark:border-zinc-800'
                    }`}
                  >
                    {reservoirDelta.adjustedTopOffEc} EC
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}