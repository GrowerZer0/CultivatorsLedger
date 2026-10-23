// apps/frontend/src/app/(app)/dashboard/DashboardClient.tsx

'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from "next/navigation";
import {
  Layers,
  Scale, 
  FlaskConical,
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
import { fetchRooms } from '@/server/actions/facility-mgmt';
import { fetchPlants } from '@/server/actions/plant-mgmt';
import { OnboardingChecklist } from "@/components/onboarding/OnBoardingChecklist";
import { WeightDrybackCard } from "@/components/dashboard/WeightDrybackCard";
import { ClimateCard } from "@/components/dashboard/ClimateCard";
import { getLatestClimateReading, getClimateTrend, type ClimateReading, type ClimatePoint } from "@/server/actions/climate";
import { NutrientCalculatorModal } from "@/components/nutrients/NutrientCalculatorModal";

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

interface DashboardClientProps {
  initialData: {
    plants: any[];
    recentLogs: any[];
    alerts: string[];
    summary: string;
  };
  onboardingState: {
    step: number;
    completed: boolean;
    dismissed: boolean;
  };
  isOnboardingActive: boolean;
}

export default function DashboardClient({ 
  onboardingState,
  isOnboardingActive 
}: DashboardClientProps) {
  const { setData } = useTelemetry();
  // --- STATE ---
  const [dbEnvironmentReadings, setDbEnvironmentReadings] = useState<EnvironmentReading[]>([]);
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestIrrigation, setLatestIrrigation] = useState<any>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [climateReading, setClimateReading] = useState<ClimateReading | null>(null);
  const [climateTrend, setClimateTrend] = useState<ClimatePoint[]>([]);
const [isNutrientModalOpen, setIsNutrientModalOpen] = useState(false);
  // AI Briefing state
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [lastBriefingTime, setLastBriefingTime] = useState<string>('Not yet generated');
  const [briefingSnapshot, setBriefingSnapshot] = useState<string | null>(null);
  const [briefingAttention, setBriefingAttention] = useState<string[]>([]);
  const [briefingActions, setBriefingActions] = useState<string[]>([]);
  const hasLoaded = useRef(false);
  const hasFetchedBriefingInitially = useRef(false);
  const [toast, setToast] = useState<{ type: "success"; message: string } | null>(null);

  // Local onboarding state
  const [localOnboardingState, setLocalOnboardingState] = useState(onboardingState);
  const [showOnboarding, setShowOnboarding] = useState(isOnboardingActive);

  const searchParams = useSearchParams();

  // Show toast for successful check-in
  useEffect(() => {
    if (searchParams.get("logged") === "true") {
      setToast({
        type: "success",
        message: "✅ Check-in logged successfully! Your data is saved.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("logged");
      window.history.replaceState({}, "", url.toString());
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Check if we should show onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch('/api/user/onboarding');
        const data = await res.json();
        const isActive = !data.onboardingCompleted && !data.onboardingDismissed;
        setShowOnboarding(isActive);
        setLocalOnboardingState({
          step: data.onboardingStep || 0,
          completed: data.onboardingCompleted || false,
          dismissed: data.onboardingDismissed || false,
        });
      } catch (error) {
        console.error('Error checking onboarding:', error);
      }
    };
    
    if (isOnboardingActive) {
      checkOnboarding();
    }
  }, [isOnboardingActive]);

  // --- DATA FETCH ---
  const loadData = useCallback(
    async (skipLoading = false) => {
      try {
        if (!skipLoading) setLoading(true);
        
        const [dashboardData, roomsData, plantsData, readings, climate, trend] = await Promise.all([
          getDashboardData(),
          fetchRooms(),
          fetchPlants(),
          getLatestRoomReadings(),
          getLatestClimateReading(),
          getClimateTrend(24),
        ]);

        setDbEnvironmentReadings(dashboardData.environmentReadings || []);
        setDbDryBackLogs(dashboardData.dryBackLogs || []);
        setLatestIrrigation(dashboardData.latestIrrigation || null);
        setClimateReading(climate);
        setClimateTrend(trend);

        const counts: Record<string, number> = {};
        plantsData.forEach((plant: any) => {
          if (plant.roomId) {
            counts[plant.roomId] = (counts[plant.roomId] || 0) + 1;
          }
        });
        setPlants(plantsData);

        let activeDryBack = undefined;
        if (dashboardData.dryBackLogs && dashboardData.dryBackLogs.length > 0) {
          const latest = dashboardData.dryBackLogs[dashboardData.dryBackLogs.length - 1];

          // Only compute if we have a usable wet weight from the log
          const wet = Number(latest.wetWeight);
          const dry = Number(latest.dryTarget);

          if (wet > 0) {
            const calc = calculateDryBack({
              id: 'active',
              cultivar: 'Environment',
              containerGallons: 5,
              wetWeight: wet,
              dryTarget: dry,
              weight: Number(latest.weight),
              loggedAt: latest.loggedAt || new Date().toISOString(),
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
    }, 60000);
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

      {/* Onboarding Checklist */}
      {showOnboarding && (
        <OnboardingChecklist
          currentStep={localOnboardingState.step}
          completed={localOnboardingState.completed}
          onDismiss={() => {
            setShowOnboarding(false);
            // Refresh to persist the dismiss
            window.location.reload();
          }}
        />
      )}

      {/* Quick Actions */}
<div className="grid grid-cols-2 gap-3">
  <button
    onClick={() => {
      window.location.href = "/check-in";
    }}
    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-sm font-bold shadow-sm transition-colors"
  >
    <Scale className="size-4" />
    Log Reading
  </button>
  <button
    onClick={() => setIsNutrientModalOpen(true)}
    className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-4 py-3 text-sm font-bold shadow-sm hover:border-emerald-500 transition-colors"
  >
    <FlaskConical className="size-4" />
    Mix Nutrients
  </button>
</div>

      {/* Climate Card */}
<ClimateCard
  reading={climateReading}
  trend={climateTrend}
  onRefresh={() => loadData(true)}
  isLoading={loading}
/>

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

            {/* Weight & Dryback Card */}
      {plants.length > 0 && (
        <WeightDrybackCard
          plants={plants}
          dryBackLogs={dbDryBackLogs}
          isLoading={loading}
          onRefresh={() => loadData(true)}
          lastRefreshTime={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        />
      )}

      {/* Daily AI Briefing 
      <div>
        <MorningBrief
          snapshot={briefingSnapshot}
          attention={briefingAttention}
          actions={briefingActions}
          lastBriefingTime={lastBriefingTime}
          isRefreshing={briefingLoading}
          onRefresh={() => loadBriefing(true)}
        />
      </div>*/}
<NutrientCalculatorModal
  isOpen={isNutrientModalOpen}
  onClose={() => setIsNutrientModalOpen(false)}
/>
    </div>
  );
}