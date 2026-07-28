'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Layers,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
  LineChart,
  Line
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import {
  type EnvironmentReading,
  type DryBackLog,
  calculateDryBack,
} from '@/lib/cultivation';

// Modular Server Actions
import {
  getDashboardData,
} from '@/app/actions/loggingreadings';

import { generateDailyBriefing } from '@/app/actions/dailyinsights';
import { useTelemetry } from '@/lib/telemetry-context';
import { MorningBrief } from '@/components/MorningBrief';

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

export default function DashboardPage() {
  const { setData } = useTelemetry();

  // --- STATE ---
  const [dbEnvironmentReadings, setDbEnvironmentReadings] = useState<EnvironmentReading[]>([]);
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestIrrigation, setLatestIrrigation] = useState<any>(null);


  // Plants State
  const [plants, setPlants] = useState<Plant[]>([]); // Use the defined Plant type
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  

  // AI Briefing state
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [lastBriefingTime, setLastBriefingTime] = useState<string>('Not yet generated');
  const [briefingSnapshot, setBriefingSnapshot] = useState<string | null>(null);
  const [briefingAttention, setBriefingAttention] = useState<string[]>([]);
  const [briefingActions, setBriefingActions] = useState<string[]>([]);

  const hasLoaded = useRef(false);
  const hasFetchedBriefingInitially = useRef(false);

  // --- DATA FETCH ---
  const loadData = useCallback(
    async (skipLoading = false) => {
      try {
        if (!skipLoading) setLoading(true);
        const data = await getDashboardData();
        setDbEnvironmentReadings(data.environmentReadings || []);
        setDbDryBackLogs(data.dryBackLogs || []);
        setLatestIrrigation(data.latestIrrigation || null);

        // Build activeDryBack from the latest log (if any)
        let activeDryBack = undefined;
        if (data.dryBackLogs && data.dryBackLogs.length > 0) {
          const latest = data.dryBackLogs[data.dryBackLogs.length - 1];
          const wet = 18.4;
          const dry = 13.2;
          const calc = calculateDryBack({
            id: 'active',
            cultivar: 'Environment',
            containerGallons: 5,
            wetWeight: wet,
            dryTarget: dry,
            weight: Number(latest.weight),
            loggedAt: new Date().toISOString(),
          });
          activeDryBack = {
            dryBackPercent: calc.dryBackPercent,
            estimatedHoursUntilWater: calc.estimatedHoursUntilWater,
            poundsUntilIrrigation: calc.poundsUntilIrrigation,
          };
        }

        // Push data to the global telemetry context
        setData({
          latestEnvironment: data.environmentReadings?.[data.environmentReadings.length - 1],
          activeDryBack,
          latestRunoffEc: data.latestIrrigation?.ec,
        });
      } catch (err) {
        console.error('Error loading environment data:', err);
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [setData]
  );

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    loadData();
  }, [loadData]);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // --- AI BRIEFING ---
  const loadBriefing = useCallback(async (force = false) => {
    if (!force && hasFetchedBriefingInitially.current) return;

    setBriefingLoading(true);
    setBriefingError(null);

    try {
      const result = await generateDailyBriefing(force);
      if (result.success) {
        setBriefingSnapshot(result.snapshot || null);
        setBriefingAttention(result.attention || []);
        setBriefingActions(result.actions || []);        
        setLastBriefingTime(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        hasFetchedBriefingInitially.current = true;
      } else {
        setBriefingError(result.error || 'Failed to load briefing');
        setLastBriefingTime('Failed');
      }
    } catch (err) {
      console.error('Failed to load briefing:', err);
      setBriefingError('Failed to load briefing');
      setLastBriefingTime('Failed');
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  // Trigger initial briefing fetch once dashboard data finishes loading
  useEffect(() => {
    if (!loading && !hasFetchedBriefingInitially.current) {
      if (dbEnvironmentReadings.length === 0 && dbDryBackLogs.length === 0) {
        setBriefing('📊 Log some data first, then AI will provide a daily summary.');
        setLastBriefingTime('Not applicable');
        return;
      }
      loadBriefing(false);
    }
  }, [loading, dbEnvironmentReadings.length, dbDryBackLogs.length, loadBriefing]);

  // --- LOADING ---
  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center text-sm font-semibold text-gray-500 dark:text-zinc-400 animate-pulse">
          Loading environment data...
        </div>
      </AppShell>
    );
  }

  // Formatted chart dataset
  const dryBackChartData = dbDryBackLogs.map((log) => ({
    time: new Date(log.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    weight: log.weight,
    runoff_ec: log.runoff_ec ?? 0,
    source: log.source || 'manual',
  }));

  const weightUnit = useMemo<'lbs' | 'g'>(() => {
    if (selectedPlantId) {
      const plant = plants.find((p) => p.id === selectedPlantId);
      if (plant?.stage === 'SEEDLING' || plant?.stage === 'CLONE') {
        return 'g';
      }
    }
    return 'lbs';
  }, [selectedPlantId, plants]);

return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4 space-y-6">
        
        {/* Daily AI Briefing */}
        <div>
          <MorningBrief
            snapshot={briefingSnapshot}
            attention={briefingAttention}
            actions={briefingActions}
            lastBriefingTime={lastBriefingTime}
            isRefreshing={briefingLoading}
            onRefresh={() => loadBriefing(true)}
          />
        </div>

        {/* VPD Chart */}
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Atmospheric VPD</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">Continuous feed</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dbEnvironmentReadings} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                <CartesianGrid stroke="#1F2937" className="opacity-40" strokeDasharray="3 3" />
                <XAxis dataKey="recordedAt" stroke="var(--axis-color)" fontSize={10} tickLine={false} />
                <YAxis stroke="#4B5563" fontSize={10} tickLine={false} label={{ value: 'VPD (kPa)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
                <ReferenceArea y1={0.8} y2={1.2} fill="#10B981" fillOpacity={0.1} stroke="#10B981" strokeOpacity={0.2} strokeDasharray="3 3" label={{ value: 'Target', position: 'top', fill: '#10B981', fontSize: 10, fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="vpd" name="VPD" stroke="#06B6D4" fill="url(#colorVpd)" strokeWidth={2} />
                <defs>
                  <linearGradient id="colorVpd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

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
