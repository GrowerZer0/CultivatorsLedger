'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  Sliders,
  Weight,
  Plus,
  Download,
  Upload,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { useTheme } from 'next-themes';
import {
  calculateDryBack,
  type DryBackLog,
} from '@/lib/cultivation';
import {
  getDashboardData,
  addDryBackLog,
  getBatches,
  createBatch,
  exportAllBatches,
  updateBatchTargets,
  getPlantsForBatch, 
  createPlant, 
  updatePlant,
  logIrrigation,
  getWaterUseData,
  getTrendInsights,
  getRecoveryStatus
} from '@/app/actions';

// --------------------------------------------
// DarkNumberField component (moved here for now)
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
        className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
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
// Main Weights Page
// --------------------------------------------
export default function WeightsPage() {
  // Theme and UI state
  const { theme, setTheme } = useTheme();

  // Batches state
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchCultivar, setNewBatchCultivar] = useState('');
  const [newBatchRoom, setNewBatchRoom] = useState('tent_1');
  const [editingBatchTargets, setEditingBatchTargets] = useState(false);
  const [editWetWeight, setEditWetWeight] = useState<number | ''>('');
  const [editDryTarget, setEditDryTarget] = useState<number | ''>('');

  // Plants State
  const [plants, setPlants] = useState<any[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantWet, setNewPlantWet] = useState<number | ''>('');
  const [newPlantDry, setNewPlantDry] = useState<number | ''>('');
  const [editingPlant, setEditingPlant] = useState<any | null>(null);

  // Dry‑back data
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [waterUseData, setWaterUseData] = useState<any>(null);
  const [waterUseLoading, setWaterUseLoading] = useState(false);
  const [trendInsights, setTrendInsights] = useState<any>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<any>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Inputs
  const [containerGallons, setContainerGallons] = useState(5);
  const [wetWeight, setWetWeight] = useState(18.4);
  const [dryTarget, setDryTarget] = useState(13.2);
  const [currentWeight, setCurrentWeight] = useState(14.2);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'g'>('lbs');
  const [isSaving, setIsSaving] = useState(false);

  // Helper: get batch stats (for display)
  function getBatchAverage(batchId: string | null): number {
    if (!batchId) return 0;
    const batch = batches.find(b => b.id === batchId);
    if (!batch || !batch.dryBackLogs || batch.dryBackLogs.length === 0) return 0;
    const total = batch.dryBackLogs.reduce((sum: number, log: any) => sum + Number(log.dryBackPercent), 0);
    return total / batch.dryBackLogs.length;
  }

  function getBatchLogCount(batchId: string | null): number {
    if (!batchId) return 0;
    const batch = batches.find(b => b.id === batchId);
    return batch?.dryBackLogs?.length || 0;
  }

  function getBatchDaysSinceStart(batchId: string | null): number {
    if (!batchId) return 0;
    const batch = batches.find(b => b.id === batchId);
    if (!batch?.startDate) return 0;
    return Math.floor((Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Load data
const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const data = await getDashboardData(selectedBatchId || undefined);
    setDbDryBackLogs(data.dryBackLogs || []);

    const fetchedBatches = await getBatches();
    setBatches(fetchedBatches);
    if (fetchedBatches.length > 0 && !selectedBatchId) {
      const active = fetchedBatches.find(b => b.isActive) || fetchedBatches[0];
      setSelectedBatchId(active.id);
    }

    // Fetch water use data
    setWaterUseLoading(true);
    const waterUse = await getWaterUseData(selectedBatchId || undefined, selectedPlantId || undefined);
    setWaterUseData(waterUse);

    // Fetch trend insights
    const insights = await getTrendInsights(selectedBatchId || undefined, selectedPlantId || undefined);
    setTrendInsights(insights);
    
    setRecoveryLoading(true);
    const recovery = await getRecoveryStatus(selectedBatchId || undefined, selectedPlantId || undefined);
    setRecoveryStatus(recovery);
    setRecoveryLoading(false);

  } catch (err) {
    console.error('Failed to load weights data:', err);
  } finally {
    setLoading(false);
    setWaterUseLoading(false);
    setRecoveryLoading(false);
  }
}, [selectedBatchId, selectedPlantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate active dry‑back from latest weight
  const activeDryBack = useMemo(() => {
    return calculateDryBack({
      id: 'active',
      cultivar: 'Active room',
      containerGallons,
      wetWeight,
      dryTarget: dryTarget,
      weight: currentWeight,
      loggedAt: new Date().toISOString(),
    });
  }, [containerGallons, wetWeight, dryTarget, currentWeight]);

  // Chart data
  const dryBackChartData = dbDryBackLogs.map((log) => ({
    time: new Date(log.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    weight: log.weight,
    runoff_ec: log.runoff_ec ?? 0,
    source: log.source || 'manual',
  }));

  // Save log
  async function handleSaveLog() {
    setIsSaving(true);
    try {
      await addDryBackLog({
        cultivar: 'Batch',
        containerGallons,
        wetWeight,
        dryTarget,
        weight: currentWeight,
        runoff_ec: 0,
        unit: weightUnit,
        batchId: selectedBatchId || undefined,
        plantId: selectedPlantId || undefined,
      });
      alert('Dry-back log saved!');
      await loadData();
    } catch (error) {
      console.error('Failed to save log:', error);
    } finally {
      setIsSaving(false);
    }
  }

  const saveBatchTargets = async () => {
  if (!selectedBatchId) return;
  try {
    const result = await updateBatchTargets({
      batchId: selectedBatchId,
      wetWeight: editWetWeight !== '' ? editWetWeight : null,
      dryTarget: editDryTarget !== '' ? editDryTarget : null,
    });
    if (result.success) {
      await loadData(); // refresh batches
      setEditingBatchTargets(false);
    } else {
      alert('Failed to update targets');
    }
  } catch (error) {
    alert('Failed to update targets');
  }
};

const loadPlants = useCallback(async () => {
  if (!selectedBatchId) {
    setPlants([]);
    setSelectedPlantId(null);
    return;
  }
  try {
    const data = await getPlantsForBatch(selectedBatchId);
    setPlants(data);
    if (data.length > 0 && !selectedPlantId) {
      setSelectedPlantId(data[0].id);
    }
  } catch (err) {
    console.error('Failed to load plants:', err);
  }
}, [selectedBatchId]);

useEffect(() => {
  loadPlants();
}, [loadPlants]);

  // Export all batches
  const handleExportAll = async () => {
    const data = await exportAllBatches();
    if (!data || data.length === 0) {
      alert('No batch data to export.');
      return;
    }
    // ... (same export logic as before – you can reuse from main page)
    // For brevity, I'll leave it as a placeholder – you can copy from the main page.
    alert('Export functionality: copy from main page');
  };

  // Loading state
  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center text-sm font-semibold text-gray-500 dark:text-zinc-400 animate-pulse">
          Loading weights data...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4">
        {/* Header with batch selector and actions */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Batch:</span>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(e.target.value || null)}
              className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
            >
              <option value="">-- Select --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.cultivar})
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewBatchModal(true)}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full transition-colors"
            >
              + New
            </button>

            <button
  onClick={() => {
    const batch = batches.find(b => b.id === selectedBatchId);
    if (batch) {
      setEditWetWeight(batch.wetWeight !== null ? Number(batch.wetWeight) : '');
      setEditDryTarget(batch.dryTarget !== null ? Number(batch.dryTarget) : '');
      setEditingBatchTargets(true);
    }
  }}
  className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
>
  Edit Targets
</button>
  {/* Plant Selector */}
  {plants.length > 0 && (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Plant:</span>
      <select
        value={selectedPlantId || ''}
        onChange={(e) => setSelectedPlantId(e.target.value || null)}
        className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
      >
        <option value="">-- Select --</option>
        {plants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )}
<button
  onClick={() => {
    setEditingPlant(null);
    setNewPlantName('');
    setNewPlantWet('');
    setNewPlantDry('');
    setShowPlantModal(true);
  }}
  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full transition-colors"
>
  + Add Plant
</button>

            {selectedBatchId && (
              <>
                <span className="w-px h-6 bg-gray-300 dark:bg-zinc-700" />
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  Day {getBatchDaysSinceStart(selectedBatchId)}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  {getBatchLogCount(selectedBatchId)} logs
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  Avg: {getBatchAverage(selectedBatchId).toFixed(1)}%
                </span>
                <Link
                  href={`/batches/${selectedBatchId}`}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-500/20 hover:bg-emerald-500/10"
                >
                  View
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Dry‑Back Analytics */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Precision Dry-Back Analytics</h3>
            </div>
            {/* Unit Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Unit:</span>
              <button
                onClick={() => setWeightUnit('lbs')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  weightUnit === 'lbs' ? 'bg-emerald-600 text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300'
                }`}
              >
                lbs
              </button>
              <button
                onClick={() => setWeightUnit('g')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  weightUnit === 'g' ? 'bg-emerald-600 text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300'
                }`}
              >
                g
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DarkNumberField
              label={`Current Container Weight (${weightUnit})`}
              value={currentWeight}
              onChange={setCurrentWeight}
            />
            <DarkNumberField
              label={`Target Dry Weight (${weightUnit})`}
              value={dryTarget}
              onChange={setDryTarget}
            />
            <DarkNumberField
              label={`Target Saturated Weight (${weightUnit})`}
              value={wetWeight}
              onChange={setWetWeight}
            />
          </div>

          {/* Watering Window */}
          <div className={`mt-5 rounded-xl p-4 border transition-all ${
            activeDryBack.isClamped
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
              : 'bg-gray-50 dark:bg-zinc-950/60 border-gray-200 dark:border-zinc-800'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase ${
              activeDryBack.isClamped ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              <Activity className="size-3.5" />
              Watering Window
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${
              activeDryBack.isClamped
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-gray-700 dark:text-zinc-300'
            }`}>
              {activeDryBack.isClamped ? (
                'Calculations suspended. Re‑verify inputs.'
              ) : (
                <>
                  Current root media is <span className="font-bold text-gray-900 dark:text-white">{activeDryBack.dryBackPercent.toFixed(1)}%</span> through dry‑back cycle. Estimated irrigation trigger in{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30">
                    {activeDryBack.estimatedHoursUntilWater} hours
                  </span>.
                </>
              )}
            </p>
          </div>

          <button
            disabled={isSaving || activeDryBack.isClamped}
            onClick={handleSaveLog}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-white text-xs px-4 py-3 shadow-lg shadow-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Log Dry-Back Reading'}
          </button>
          <button
  onClick={async () => {
    if (!selectedBatchId && !selectedPlantId) {
      alert('Please select a batch or plant first.');
      return;
    }
    setIsSaving(true);
    try {
      await logIrrigation({
        batchId: selectedBatchId || undefined,
        plantId: selectedPlantId || undefined,
        weight: currentWeight,
        notes: 'Irrigation via button',
      });
      alert('Irrigation logged!');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to log irrigation.');
    } finally {
      setIsSaving(false);
    }
  }}
  disabled={isSaving || activeDryBack.isClamped}
  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] font-bold text-white text-xs px-4 py-3 shadow-lg shadow-cyan-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
>
  {isSaving ? 'Logging...' : '💧 Irrigate Now'}
</button>
        </div>

        {/* Water Use Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Daily Water Use</p>
            {waterUseLoading ? (
              <p className="text-sm text-gray-400 animate-pulse">Calculating...</p>
            ) : waterUseData ? (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {waterUseData.dailyWaterUse} lbs/day
              </p>
            ) : (
              <p className="text-sm text-gray-500">Log more data</p>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Projected Irrigation</p>
            {waterUseLoading ? (
              <p className="text-sm text-gray-400 animate-pulse">Calculating...</p>
            ) : waterUseData ? (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(waterUseData.hoursUntilIrrigation)} hrs
              </p>
            ) : (
              <p className="text-sm text-gray-500">Log more data</p>
            )}
          </div>
        </div>

        {/* Trend Insights */}
        {trendInsights && (trendInsights.drybackSpeed || trendInsights.uptakeTrend) && (
          <div className="mt-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Crop Steering Insights</h4>
            <div className="space-y-2 text-sm">
              {trendInsights.drybackSpeed && (
                <p className="text-gray-800 dark:text-zinc-200">
                  {trendInsights.drybackSpeed.direction === 'faster' && '🔽 Drying '}
                  {trendInsights.drybackSpeed.direction === 'slower' && '🔼 Drying '}
                  {trendInsights.drybackSpeed.direction === 'stable' && '➖ Drying at '}
                  {trendInsights.drybackSpeed.pct !== 0 && `${Math.abs(trendInsights.drybackSpeed.pct)}% `}
                  {trendInsights.drybackSpeed.direction === 'faster' && 'faster than the last 5 irrigations'}
                  {trendInsights.drybackSpeed.direction === 'slower' && 'slower than the last 5 irrigations'}
                  {trendInsights.drybackSpeed.direction === 'stable' && 'at the same rate as the last 5 irrigations'}
                </p>
              )}
              {trendInsights.uptakeTrend && (
                <p className="text-gray-800 dark:text-zinc-200">
                  {trendInsights.uptakeTrend.direction === 'increasing' && '📈 Daily water uptake increased '}
                  {trendInsights.uptakeTrend.direction === 'decreasing' && '📉 Daily water uptake decreased '}
                  {trendInsights.uptakeTrend.direction === 'stable' && '➖ Daily water uptake stable '}
                  {trendInsights.uptakeTrend.pct !== 0 && `${Math.abs(trendInsights.uptakeTrend.pct)}% `}
                  {trendInsights.uptakeTrend.direction === 'increasing' && '– root expansion likely'}
                  {trendInsights.uptakeTrend.direction === 'decreasing' && '– possible stress or slowing growth'}
                  {trendInsights.uptakeTrend.direction === 'stable' && '– maintaining'}
                </p>
              )}
            </div>
          </div>
            )}

        {/* Recovery Status */}
        {recoveryStatus && recoveryStatus.phase > 0 && (
          <div className="mt-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Recovery Status</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Phase {recoveryStatus.phase}: {recoveryStatus.status}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{recoveryStatus.recommendation}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                recoveryStatus.phase === 1 ? 'bg-red-500/20 text-red-500' :
                recoveryStatus.phase === 2 ? 'bg-yellow-500/20 text-yellow-500' :
                recoveryStatus.phase === 3 ? 'bg-blue-500/20 text-blue-500' :
                recoveryStatus.phase === 4 ? 'bg-green-500/20 text-green-500' :
                'bg-gray-500/20 text-gray-500'
              }`}>
                Phase {recoveryStatus.phase}
              </span>
            </div>
          </div>
        )}

        {/* Dry‑Back Trend Chart */}
        <div className="mt-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Dry-Back Trend</h3>
            <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">{dbDryBackLogs.length} points</span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dryBackChartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                <CartesianGrid stroke="#1F2937" className="opacity-40" strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  stroke="var(--axis-color)"
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#4B5563"
                  fontSize={10}
                  tickLine={false}
                  label={{
                    value: `Weight (${weightUnit})`,
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#9CA3AF',
                    fontSize: 10,
                  }}
                />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
                <Line type="monotone" dataKey="weight" name="Weight" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Batch Modal */}
        {showNewBatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-4">Create New Batch</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Batch Name"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Cultivar"
                  value={newBatchCultivar}
                  onChange={(e) => setNewBatchCultivar(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
                <select
                  value={newBatchRoom}
                  onChange={(e) => setNewBatchRoom(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="tent_1">Tent 1</option>
                  <option value="tent_2">Tent 2</option>
                  <option value="room_a">Room A</option>
                  <option value="room_b">Room B</option>
                </select>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowNewBatchModal(false)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!newBatchName || !newBatchCultivar) return;
                      await createBatch({
                        name: newBatchName,
                        cultivar: newBatchCultivar,
                        roomId: newBatchRoom,
                      });
                      setShowNewBatchModal(false);
                      setNewBatchName('');
                      setNewBatchCultivar('');
                      setNewBatchRoom('tent_1');
                      loadData();
                    }}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Batch Targets Modal */}
{editingBatchTargets && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
      <h2 className="text-lg font-bold text-white mb-4">Set Weight Targets</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1">
            Target Saturated Weight (lbs)
          </label>
          <input
            type="number"
            step="0.05"
            value={editWetWeight}
            onChange={(e) => setEditWetWeight(parseFloat(e.target.value))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1">
            Target Dry Weight (lbs)
          </label>
          <input
            type="number"
            step="0.05"
            value={editDryTarget}
            onChange={(e) => setEditDryTarget(parseFloat(e.target.value))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setEditingBatchTargets(false)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveBatchTargets}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Plant Management Modal */}
{showPlantModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">
          {editingPlant ? 'Edit Plant' : 'Add New Plant'}
        </h2>
        <button
          onClick={() => setShowPlantModal(false)}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1">Plant Name (Cultivar)</label>
          <input
            type="text"
            placeholder="e.g., Blueberry Muffin #2"
            value={newPlantName}
            onChange={(e) => setNewPlantName(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1">Target Saturated Weight (lbs)</label>
          <input
            type="number"
            step="0.05"
            placeholder="18.4"
            value={newPlantWet}
            onChange={(e) => setNewPlantWet(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1">Target Dry Weight (lbs)</label>
          <input
            type="number"
            step="0.05"
            placeholder="13.2"
            value={newPlantDry}
            onChange={(e) => setNewPlantDry(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4 mt-2 border-t border-zinc-800">
        <button
          onClick={() => setShowPlantModal(false)}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!selectedBatchId) {
              alert('Please select a batch first.');
              return;
            }
            if (!newPlantName.trim()) {
              alert('Please enter a plant name');
              return;
            }
            try {
              if (editingPlant) {
                await updatePlant({
                  id: editingPlant.id,
                  name: newPlantName,
                  wetWeight: newPlantWet !== '' ? newPlantWet : null,
                  dryTarget: newPlantDry !== '' ? newPlantDry : null,
                });
              } else {
                await createPlant({
                  batchId: selectedBatchId,
                  name: newPlantName,
                  wetWeight: newPlantWet !== '' ? newPlantWet : undefined,
                  dryTarget: newPlantDry !== '' ? newPlantDry : undefined,
                });
              }
              setShowPlantModal(false);
              loadPlants();
            } catch (err) {
              console.error('Plant save error:', err);
              alert('Failed to save plant: ' + (err instanceof Error ? err.message : 'unknown error'));
            }
          }}
          className="..."
        >
  {editingPlant ? 'Update' : 'Create'}
</button>
      </div>
    </div>
  </div>
)}
      </div>
    </AppShell>
  );
}