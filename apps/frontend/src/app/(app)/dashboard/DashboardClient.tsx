// apps/frontend/src/app/(app)/dashboard/DashboardClient.tsx

'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from "next/navigation";
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
import {
  type EnvironmentReading,
  type DryBackLog,
  calculateDryBack,
} from '@/lib/cultivation';
import {
  getDashboardData,
  getLatestRoomReadings,
} from '@/server/actions/loggingreadings';
import { generateDailyBriefing } from '@/server/actions/dailyinsights';
import { useTelemetry } from '@/lib/telemetry-context';
import { MorningBrief } from '@/components/MorningBrief';
import { RoomCard } from '@/components/facility/RoomCard';
import { fetchRooms } from '@/server/actions/facility-mgmt';
import { fetchPlants } from '@/server/actions/plant-mgmt';
import { ActivityItem, RecentActivity } from "@/components/dashboard/RecentActivity";

type Plant = {
  id: string;
  name: string;
  strain?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  stage?: string | null;
  containerGallons?: number | null;
};

export default function DashboardPage() {
  const { setData } = useTelemetry();
  // --- STATE ---
  const [dbEnvironmentReadings, setDbEnvironmentReadings] = useState<EnvironmentReading[]>([]);
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestIrrigation, setLatestIrrigation] = useState<any>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  
  // New states for room cards
  const [rooms, setRooms] = useState<any[]>([]);
  const [latestRoomReadings, setLatestRoomReadings] = useState<Record<string, any>>({});
  const [plantCounts, setPlantCounts] = useState<Record<string, number>>({});

  // AI Briefing state
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [lastBriefingTime, setLastBriefingTime] = useState<string>('Not yet generated');
  const [briefingSnapshot, setBriefingSnapshot] = useState<string | null>(null);
  const [briefingAttention, setBriefingAttention] = useState<string[]>([]);
  const [briefingActions, setBriefingActions] = useState<string[]>([]);
  const hasLoaded = useRef(false);
  const hasFetchedBriefingInitially = useRef(false);

  const [toast, setToast] = useState<{ type: "success"; message: string } | null>(null);

  const searchParams = useSearchParams();

useEffect(() => {
  if (searchParams.get("logged") === "true") {
    setToast({
      type: "success",
      message: "✅ Check-in logged successfully! Your data is saved.",
    });
    // Clear the query param without refreshing
    const url = new URL(window.location.href);
    url.searchParams.delete("logged");
    window.history.replaceState({}, "", url.toString());
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }
}, [searchParams]);

const recentActivity = useMemo<ActivityItem[]>(() => {
  const items: ActivityItem[] = [];

  // Plant logs (dryback logs)
  dbDryBackLogs.forEach((log) => {
    const plant = plants.find((p) => p.id === log.plantId);
    if (!plant) return;
    items.push({
      id: log.id,
      type: "plant",
      timestamp: log.loggedAt,
      label: plant.name,
      detail: `Weight: ${log.weight.toFixed(1)} lbs · ${log.source || "manual"}`,
      metadata: {
        weight: log.weight,
        watered: log.watered || false,
        fed: log.fed || false,
        training: log.trainingEvent || undefined,
      },
    });
  });

  // Climate logs
  dbEnvironmentReadings.forEach((reading) => {
    items.push({
      id: reading.id,
      type: "climate",
      timestamp: reading.recordedAt,
      label: "Room Climate",
      detail: `${Math.round(reading.temperatureF)}°F · ${Math.round(reading.humidity)}% · ${reading.vpd.toFixed(2)} kPa`,
      metadata: {
        temperatureF: Math.round(reading.temperatureF),
        humidity: Math.round(reading.humidity),
        vpd: reading.vpd,
      },
    });
  });

  return items;
}, [dbDryBackLogs, dbEnvironmentReadings, plants]);

  // --- DATA FETCH ---
  const loadData = useCallback(
    async (skipLoading = false) => {
      try {
        if (!skipLoading) setLoading(true);
        
        // Fetch all data in parallel
        const [dashboardData, roomsData, plantsData, readings] = await Promise.all([
          getDashboardData(),
          fetchRooms(),
          fetchPlants(),
          getLatestRoomReadings(),
        ]);

        setDbEnvironmentReadings(dashboardData.environmentReadings || []);
        setDbDryBackLogs(dashboardData.dryBackLogs || []);
        setLatestIrrigation(dashboardData.latestIrrigation || null);
        setRooms(roomsData);
        setLatestRoomReadings(readings);

        // Compute plant count per room
        const counts: Record<string, number> = {};
        plantsData.forEach((plant: any) => {
          if (plant.roomId) {
            counts[plant.roomId] = (counts[plant.roomId] || 0) + 1;
          }
        });
        setPlantCounts(counts);
        setPlants(plantsData);

        // Build activeDryBack from latest log (existing logic)
        let activeDryBack = undefined;
        if (dashboardData.dryBackLogs && dashboardData.dryBackLogs.length > 0) {
          const latest = dashboardData.dryBackLogs[dashboardData.dryBackLogs.length - 1];
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
            watered: false,
            fed: false,
            trainingEvent: null,
          });
          activeDryBack = {
            dryBackPercent: calc.dryBackPercent,
            estimatedHoursUntilWater: calc.estimatedHoursUntilWater,
            poundsUntilIrrigation: calc.poundsUntilIrrigation,
          };
        }

        setData({
          latestEnvironment: dashboardData.environmentReadings?.[dashboardData.environmentReadings.length - 1],
          activeDryBack,
          latestRunoffEc: dashboardData.latestIrrigation?.ec,
        });
      } catch (err) {
        console.error('Error loading data:', err);
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
        setLastBriefingTime('Failed');
      }
    } catch (err) {
      console.error('Failed to load briefing:', err);
      setLastBriefingTime('Failed');
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !hasFetchedBriefingInitially.current) {
      loadBriefing(false);
    }
  }, [loading, loadBriefing]);

  // --- COMPUTED VALUES ---
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

  // --- LOADING ---
  if (loading) {
    return (
      <div className="flex h-[75vh] items-center justify-center text-sm font-semibold text-gray-500 dark:text-zinc-400 animate-pulse">
        Loading environment data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4 space-y-6">
      
      {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 max-w-sm animate-slide-in-right">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/95 dark:bg-emerald-950/90 px-4 py-3 shadow-lg backdrop-blur-sm">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {toast.message}
              </p>
            </div>
          </div>
        )}

      {/* Room Cards */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-3">
          Your Rooms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              id={room.id}
              name={room.name}
              type={room.type}
              plantCount={plantCounts[room.id] || 0}
              latestReading={latestRoomReadings[room.id] || null}
            />
          ))}
        </div>
        {rooms.length === 0 && (
          <p className="text-center text-zinc-500 py-8">
            No rooms yet. <a href="/rooms" className="text-emerald-500 hover:underline">Create one</a>.
          </p>
        )}
      </div>

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

      {/* Recent Activity */}
<RecentActivity items={recentActivity} maxItems={5} />

    </div>
  );
}