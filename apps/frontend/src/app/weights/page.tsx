'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import useRouter
import {
  Activity,
  Droplets,
  Thermometer,
  Gauge,
  TreePine, // For plant icons in the consolidated card
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
  getRooms, // Need to import getRooms for RoomNav
  getPlantsForBatch,
  logIrrigation,
  getWaterUseData,
  getTrendInsights,
  getRecoveryStatus,
  getDiagnostics,
} from '@/app/actions';

// Define Plant type more accurately for local use
type Plant = {
  id: string;
  name: string;
  strain?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  stage?: string | null; // Assuming stage exists for unit logic
  containerGallons?: number | null; // Assuming containerGallons also exists on Plant
};

// --------------------------------------------
// DarkNumberField Component
// --------------------------------------------
type DarkNumberFieldProps = {
  label: string;
  value: number | ''; // Allow empty string for input
  onChange: (value: number | '') => void; // Allow empty string for onChange
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
        onChange={(e) => {
          // Pass empty string if input is empty, otherwise parse to number
          onChange(e.target.value === '' ? '' : Number(e.target.value));
        }}
      />
    </label>
  );
}

// --------------------------------------------
// Plant & Tent Navigation Bar
// --------------------------------------------
interface RoomNavProps {
  rooms: { id: string; name: string }[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
}

function RoomNav({ rooms, selectedRoomId, onSelectRoom }: RoomNavProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
      <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider pr-1">
        Location:
      </span>
      <button
        onClick={() => onSelectRoom(null)}
        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          selectedRoomId === null
            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
            : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        All Rooms
      </button>
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
            selectedRoomId === room.id
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
              : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {room.name}
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------
// Main Weights Page
// --------------------------------------------
export default function WeightsPage() {
  const router = useRouter(); // Initialize useRouter
  const { theme, setTheme } = useTheme();

  // Rooms & Locations state
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Batches state
  const [batches, setBatches] = useState<any[]>([]); // Using any[] temporarily, should be Batch[]
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Plants State
  const [plants, setPlants] = useState<Plant[]>([]); // Use the defined Plant type
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);

  // Environmental Telemetry Data
  const [climateLogs, setClimateLogs] = useState<any[]>([]);

  // Dry‑back data
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [waterUseData, setWaterUseData] = useState<any>(null);
  const [waterUseLoading, setLoadingWaterUseData] = useState(false); // Renamed to avoid confusion with general loading
  const [trendInsights, setTrendInsights] = useState<any>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<any>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  // Inputs
  const [containerGallons, setContainerGallons] = useState(5); // Default, will be overwritten by selection
  const [wetWeight, setWetWeight] = useState<number | ''>(18.4); // Default, will be overwritten by selection
  const [dryTarget, setDryTarget] = useState<number | ''>(13.2); // Default, will be overwritten by selection
  const [currentWeight, setCurrentWeight] = useState(14.2);
  const [isSaving, setIsSaving] = useState(false);

  // Determine weight unit based on selected plant's stage
  const weightUnit = useMemo<'lbs' | 'g'>(() => {
    if (selectedPlantId) {
      const plant = plants.find((p) => p.id === selectedPlantId);
      if (plant?.stage === 'SEEDLING' || plant?.stage === 'CLONE') {
        return 'g';
      }
    }
    return 'lbs'; // Default to lbs for other stages or if no plant selected
  }, [selectedPlantId, plants]);

  // Stats Helpers
  function getBatchAverage(batchId: string | null): number {
    if (!batchId) return 0;
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || !batch.dryBackLogs || batch.dryBackLogs.length === 0) return 0;
    const total = batch.dryBackLogs.reduce((sum: number, log: any) => sum + Number(log.dryBackPercent), 0);
    return total / batch.dryBackLogs.length;
  }

  function getBatchLogCount(batchId: string | null): number {
    if (!batchId) return 0;
    const batch = batches.find((b) => b.id === batchId);
    return batch?.dryBackLogs?.length || 0;
  }

  function getBatchDaysSinceStart(batchId: string | null): number {
    if (!batchId) return 0;
    const batch = batches.find((b) => b.id === batchId);
    if (!batch?.startDate) return 0;
    return Math.floor((Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Active climate log tied to selected room
  const activeRoomClimate = useMemo(() => {
    if (!selectedRoomId) return climateLogs[0] || null;
    return climateLogs.find((c) => c.roomId === selectedRoomId) || null;
  }, [climateLogs, selectedRoomId]);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboardData(selectedBatchId || undefined);
      setDbDryBackLogs((data.dryBackLogs as unknown as DryBackLog[]) || []);
      
      // FIX 1: Map environmentReadings to climateLogs
      const mappedClimate = (data.environmentReadings || []).map((reading) => ({
        airTempC: reading.temperature,
        relativeHumidity: reading.humidity,
        calculatedVpdKpa: reading.vpd,
        recordedAt: reading.recordedAt,
      }));
      setClimateLogs(mappedClimate);

      }));
      setClimateLogs(mappedClimate);

      const fetchedBatches = await getBatches();
      setBatches(fetchedBatches);
      
      const fetchedRooms = await getRooms(); // Fetch rooms directly
      setRooms(fetchedRooms);

      if (fetchedBatches.length > 0 && !selectedBatchId) {
        const active = fetchedBatches.find((b: any) => b.isActive) || fetchedBatches[0];
        setSelectedBatchId(active.id);
      }

      // Water use data
      setLoadingWaterUseData(true);
      const waterUse = await getWaterUseData(selectedBatchId || undefined, selectedPlantId || undefined);
      setWaterUseData(waterUse);

      // Trend insights
      const insights = await getTrendInsights(selectedBatchId || undefined, selectedPlantId || undefined);
      setTrendInsights(insights);
      
      setRecoveryLoading(true);
      const recovery = await getRecoveryStatus(selectedBatchId || undefined, selectedPlantId || undefined);
      setRecoveryStatus(recovery);
      setRecoveryLoading(false);

      setDiagnosticsLoading(true);
      const diag = await getDiagnostics(selectedBatchId || undefined, selectedPlantId || undefined);
      setDiagnostics(diag);
      setDiagnosticsLoading(false);

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

  // Effect to synchronize wetWeight and dryTarget based on selected plant or batch
  useEffect(() => {
    if (selectedPlantId) {
      const plant = plants.find((p) => p.id === selectedPlantId);
      if (plant) {
        setWetWeight(plant.wetWeight !== null ? Number(plant.wetWeight) : '');
        setDryTarget(plant.dryTarget !== null ? Number(plant.dryTarget) : '');
      }
    } else if (selectedBatchId) {
      const batch = batches.find((b) => b.id === selectedBatchId);
      if (batch) {
        setWetWeight(batch.wetWeight !== null ? Number(batch.wetWeight) : '');
        setDryTarget(batch.dryTarget !== null ? Number(batch.dryTarget) : '');
      }
    } else {
      // Reset to defaults or empty if nothing is selected
      setWetWeight(18.4); // Or '' if you prefer empty
      setDryTarget(13.2); // Or ''
    }
  }, [selectedPlantId, selectedBatchId, plants, batches]);

  const loadPlants = useCallback(async () => {
    if (!selectedBatchId) {
      setPlants([]);
      setSelectedPlantId(null);
      return;
    }
    try {
      const data = await getPlantsForBatch(selectedBatchId);
      // Assuming 'stage' property exists on plant objects returned from getPlantsForBatch
      // Also casting Decimal values to number for consistency
      const formattedPlants: Plant[] = data.map((plant: any) => ({
        ...plant,
        wetWeight: plant.wetWeight !== null ? Number(plant.wetWeight) : null,
        dryTarget: plant.dryTarget !== null ? Number(plant.dryTarget) : null,
        containerGallons: plant.containerGallons !== null ? Number(plant.containerGallons) : null,
        stage: plant.stage || 'VEGETATIVE', // Default to VEGETATIVE if stage is not provided
      }));
      setPlants(formattedPlants);
    } catch (err) {
      console.error('Failed to load plants:', err);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  // Dry-back calculation
  const activeDryBack = useMemo(() => {
    // Ensure wetWeight and dryTarget are numbers for calculation
    const currentWetWeight = typeof wetWeight === 'number' ? wetWeight : 0;
    const currentDryTarget = typeof dryTarget === 'number' ? dryTarget : 0;

    return calculateDryBack({
      id: 'active',
      cultivar: 'Active room', // This cultivar is a placeholder for display.
      containerGallons,
      wetWeight: currentWetWeight,
      dryTarget: currentDryTarget,
      weight: currentWeight,
      loggedAt: new Date().toISOString(),
    });
  }, [containerGallons, wetWeight, dryTarget, currentWeight]);

  // Chart dataset
  const dryBackChartData = dbDryBackLogs.map((log) => ({
    time: new Date(log.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    weight: log.weight,
    runoff_ec: log.runoff_ec ?? 0,
    source: log.source || 'manual',
  }));

  // FIX 3: Save log handlers with type assertion or mapped parameters
  async function handleSaveLog() {
    setIsSaving(true);
    try {
      await addDryBackLog({
        cultivar: 'Batch', // Placeholder, the actual cultivar comes from the batch/plant config
        containerGallons,
        wetWeight: typeof wetWeight === 'number' ? wetWeight : 0,
        dryTarget: typeof dryTarget === 'number' ? dryTarget : 0,
        weight: currentWeight,
        runoff_ec: 0, // Assuming 0 for now as there's no input for it here
        unit: weightUnit,
        batchId: selectedBatchId || undefined,
        plantId: selectedPlantId || undefined, // Explicitly pass plantId
      } as any); // Type assertion for now, consider refining DryBackLog type
      alert('Dry-back log saved!');
      await loadData();
    } catch (error) {
      console.error('Failed to save log:', error);
    } finally {
      setIsSaving(false);
    }
  }

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
        
        {/* Header Block: Title & Environmental Stats */}
        <header className="space-y-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-zinc-800 pb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Weights & Telemetry
              </h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Monitor moisture levels, dry-back percentages, and unified environmental stats.
              </p>
            </div>

            {/* Environmental Stat Bar */}
            <div className="flex items-center gap-4 bg-gray-50 dark:bg-zinc-900/80 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-1.5">
                <Thermometer className="size-3.5 text-emerald-500" />
                <div>
                  <span className="text-gray-400 dark:text-zinc-500 block text-[10px]">Air Temp</span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">
                    {activeRoomClimate?.airTempC ? `${activeRoomClimate.airTempC}°C` : '--'}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <Droplets className="size-3.5 text-cyan-500" />
                <div>
                  <span className="text-gray-400 dark:text-zinc-500 block text-[10px]">RH</span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">
                    {activeRoomClimate?.relativeHumidity ? `${activeRoomClimate.relativeHumidity}%` : '--'}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <Gauge className="size-3.5 text-amber-500" />
                <div>
                  <span className="text-gray-400 dark:text-zinc-500 block text-[10px]">VPD</span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">
                    {activeRoomClimate?.calculatedVpdKpa ? `${activeRoomClimate.calculatedVpdKpa} kPa` : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Navigation: Location, Batch, Plant */}
          <div className="flex flex-col gap-3 pb-2 border-b border-gray-200 dark:border-zinc-800">
            {/* Top Level: Location / Room Selector */}
            <RoomNav rooms={rooms} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />

            {/* Middle Level: Batch Selector */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider pr-1">
                Batch:
              </span>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value || null);
                  setSelectedPlantId(null); // Reset plant selection when batch changes
                  setContainerGallons(plants.find((p) => p.batchId === e.target.value)?.containerGallons || 5); // Update container gallons
                }}
                className="bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white outline-none focus:border-emerald-500 transition-all"
              >
                <option value="">All Batches</option>
                {batches
                  .filter((b) => !selectedRoomId || b.roomId === selectedRoomId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.cultivar})
                    </option>
                  ))}
              </select>
              <button
                onClick={() => router.push('/settings')}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1"
              >
                Manage Facility
              </button>
            </div>

            {/* Bottom Level: Plant Selector for selected Batch */}
            {selectedBatchId && plants.filter(p => (!selectedBatchId || p.batchId === selectedBatchId) && (!selectedRoomId || p.roomId === selectedRoomId)).length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider pr-1">
                  Plant:
                </span>
                {plants
                  .filter((plant) => (!selectedBatchId || plant.batchId === selectedBatchId) && (!selectedRoomId || plant.roomId === selectedRoomId))
                  .map((plant) => (
                    <button
                      key={plant.id}
                      onClick={() => {
                        setSelectedPlantId(plant.id);
                        setContainerGallons(plant.containerGallons || 5); // Update container gallons on plant selection
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                        selectedPlantId === plant.id
                          ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                          : 'bg-transparent text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:text-gray-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <span>{plant.name}</span>
                      {plant.strain && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded border border-zinc-700 bg-zinc-900/60 opacity-80">
                          {plant.strain}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )}
            {/* Display batch stats only if a batch is selected */}
            {selectedBatchId && (
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400 pt-2 border-t border-gray-200 dark:border-zinc-800 mt-2">
                <span>
                  Day {getBatchDaysSinceStart(selectedBatchId)}
                </span>
                <span>
                  {getBatchLogCount(selectedBatchId)} logs
                </span>
                <span className="text-emerald-400 font-mono">
                  Avg Dry-Back: {getBatchAverage(selectedBatchId).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Dry‑Back Analytics Panel */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <TreePine className="size-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dry-Back Input & Analytics ({selectedPlantId ? plants.find(p => p.id === selectedPlantId)?.name : 'Batch'} - {weightUnit})</h3>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DarkNumberField
              label={`Current Container Weight (${weightUnit})`}
              value={currentWeight}
              onChange={(val) => setCurrentWeight(val === '' ? 0 : val)}
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

          {/* Watering Window & Feed Analytics Card */}
          <div className={`mt-5 rounded-2xl p-4 border shadow-xl transition-all ${
            activeDryBack.isClamped || wetWeight === '' || dryTarget === ''
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
              : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase ${
              activeDryBack.isClamped || wetWeight === '' || dryTarget === '' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              <Activity className="size-3.5" />
              Watering Window & Feed Analytics
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${
              activeDryBack.isClamped || wetWeight === '' || dryTarget === ''
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-gray-700 dark:text-zinc-300'
            }`}>
              {activeDryBack.isClamped || wetWeight === '' || dryTarget === '' ? (
                'Calculations suspended. Re‑verify inputs or select a plant/batch with defined targets.'
              ) : (
                <>
                  <span className="font-bold text-gray-900 dark:text-white">{activeDryBack.dryBackPercent.toFixed(1)}%</span> moisture remaining.
                  Daily transpiration rate is <span className="font-bold text-gray-900 dark:text-white">{waterUseData?.dailyWaterUse ? `${waterUseData.dailyWaterUse.toFixed(2)} ${weightUnit}/day` : 'N/A'}</span>.
                  Estimated irrigation trigger in{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30">
                    {waterUseData?.hoursUntilIrrigation ? `${Math.round(waterUseData.hoursUntilIrrigation)} hours` : `${activeDryBack.estimatedHoursUntilWater} hours`}
                  </span>.
                </>
              )}
            </p>
            {loadingWaterUseData ? (
              <p className="text-sm text-gray-400 animate-pulse mt-2">Calculating...</p>
            ) : !waterUseData?.dailyWaterUse && !waterUseData?.hoursUntilIrrigation && (
              <p className="text-sm text-gray-500 mt-2">Log more data for transpiration rate and irrigation projections.</p>
            )}
          </div>

          <button
            disabled={isSaving || activeDryBack.isClamped || !selectedBatchId || wetWeight === '' || dryTarget === ''}
            onClick={handleSaveLog}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-white text-xs px-4 py-3 shadow-lg shadow-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Log Dry-Back Reading'}
          </button>
          
          <button
            onClick={async () => {
              if (!selectedBatchId) {
                alert('Please select a batch before logging irrigation.');
                return;
              }
              setIsSaving(true);
              try {
                await logIrrigation({
                  batchId: selectedBatchId, // Explicitly use selectedBatchId
                  plantId: selectedPlantId || undefined, // Explicitly use selectedPlantId
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
            disabled={isSaving || activeDryBack.isClamped || !selectedBatchId}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] font-bold text-white text-xs px-4 py-3 shadow-lg shadow-cyan-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSaving ? 'Logging...' : '💧 Irrigate Now'}
          </button>
        </div>

        {/* Trend Insights - Moved to be right after Watering Window for better flow */}
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

        {/* Diagnostic Engine */}
        {diagnostics && !diagnostics.error && (
          <div className="mt-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Diagnostic Engine</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-zinc-300">💧 Overwatered</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{diagnostics.overwater}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${diagnostics.overwater}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-zinc-300">🏜️ Drought</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{diagnostics.drought}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${diagnostics.drought}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-zinc-300">🧪 Nutrient Deficiency</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{diagnostics.nutrient}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${diagnostics.nutrient}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-zinc-300">☀️ Light Stress</span>
                <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{diagnostics.lightStress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${diagnostics.lightStress}%` }} />
              </div>
              <div className="mt-3 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700">
                <p className="text-xs font-medium text-gray-800 dark:text-zinc-200">
                  💡 {diagnostics.recommendation}
                </p>
              </div>
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

      </div>
    </AppShell>
  );
}
