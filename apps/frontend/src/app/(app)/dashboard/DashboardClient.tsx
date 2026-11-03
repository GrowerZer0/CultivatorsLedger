'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from "next/navigation";
import {
  type EnvironmentReading,
  type DryBackLog,
  calculateDryBack,
} from '@/lib/cultivation-engine';
import { Sprout } from "lucide-react";
import {
  getDashboardData,
  getLatestRoomReadings,
} from '@/server/actions/loggingreadings';
import { generateDailyBriefing } from '@/server/actions/dailyinsights';
import { useTelemetry } from '@/lib/telemetry-context';
import { fetchRooms } from '@/server/actions/facility-mgmt';
import { fetchPlants } from '@/server/actions/plant-mgmt';
import { PlantStatusList } from "@/components/dashboard/PlantStatusList";
import { QuickActionsMenu } from "@/components/dashboard/QuickActionsMenu";
import { ClimateCard } from "@/components/dashboard/ClimateCard";
import { getLatestClimateReading, getClimateTrend, type ClimateReading, type ClimatePoint } from "@/server/actions/climate";
import { NutrientCalculatorModal } from "@/components/nutrients/NutrientCalculatorModal";
import { SensorStatusBanner, type SensorStatus } from "@/components/dashboard/SensorStatusBanner";
import { StartGrowModal } from "@/components/dashboard/StartGrowModal";
import { ActionCenter } from "@/components/dashboard/ActionCenter";
import type { Plant } from "@/types/plant";

interface DashboardClientProps {
  initialData: {
    plants: any[];
    recentLogs: any[];
    alerts: string[];
    summary: string;
    sensorStatus: SensorStatus[];
    rooms: any[];
    batches: any[];
    lights: any[];
    actionItems: any[];
  };
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const { setData } = useTelemetry();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState<Plant[]>(initialData.plants);
  const [climateReading, setClimateReading] = useState<ClimateReading | null>(null);
  const [climateTrend, setClimateTrend] = useState<ClimatePoint[]>([]);
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState(false);
  const [isStartGrowModalOpen, setIsStartGrowModalOpen] = useState(false);
  const hasLoaded = useRef(false);
  const [toast, setToast] = useState<{ type: "success"; message: string } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("logged") === "true") {
      setToast({ type: "success", message: "✅ Check-in logged successfully!" });
      const url = new URL(window.location.href);
      url.searchParams.delete("logged");
      window.history.replaceState({}, "", url.toString());
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

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

        setClimateReading(climate);
        setClimateTrend(trend);
        setPlants(plantsData as any);

        let activeDryBack = undefined;
        if (dashboardData.dryBackLogs && dashboardData.dryBackLogs.length > 0) {
          const latest = dashboardData.dryBackLogs[dashboardData.dryBackLogs.length - 1];
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

  useEffect(() => {
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-[75vh] items-center justify-center text-sm font-semibold text-gray-500 dark:text-zinc-400 animate-pulse">
        Loading environment data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{initialData.summary}</p>
        </div>
        <QuickActionsMenu
          onLogReading={() => router.push("/check-in?returnTo=/dashboard")}
          onStartGrow={() => setIsStartGrowModalOpen(true)}
          onNutrientCalc={() => setIsNutrientModalOpen(true)}
        />
      </div>

      <SensorStatusBanner sensors={initialData.sensorStatus} />
      
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-emerald-700">{toast.message}</p>
          </div>
        </div>
      )}

      <ActionCenter items={initialData.actionItems || []} />

      {plants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 rounded-2xl shadow-sm text-center">
          <Sprout className="size-8 text-emerald-600 mb-4" />
          <h2 className="text-xl font-bold mb-2">Welcome to Cultivator's Ledger</h2>
          <p className="text-sm text-zinc-500 mb-6">You don't have any active grows right now.</p>
          <button onClick={() => setIsStartGrowModalOpen(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold">
            Start Your First Grow
          </button>
        </div>
      )}

      {plants.length > 0 && (
        <div className="space-y-6">
          <ClimateCard
            reading={climateReading}
            trend={climateTrend}
            stage={plants[0]?.stage || "vegetative"}
            onRefresh={() => loadData(true)}
            isLoading={loading}
          />

          <PlantStatusList
            plants={plants}
            isLoading={loading}
            onRefresh={() => loadData(true)}
            lastRefreshTime={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          />
        </div>
      )}

      <StartGrowModal
        isOpen={isStartGrowModalOpen}
        onClose={() => setIsStartGrowModalOpen(false)}
        rooms={initialData.rooms || []}
        batches={initialData.batches || []}
        lights={initialData.lights || []}
      />
      <NutrientCalculatorModal
        isOpen={isNutrientModalOpen}
        onClose={() => setIsNutrientModalOpen(false)}
      />
    </div>
  );
}