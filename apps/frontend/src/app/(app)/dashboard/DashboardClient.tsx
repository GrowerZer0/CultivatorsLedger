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
import { useTelemetry } from '@/lib/telemetry-context';
import { fetchRooms } from '@/server/actions/facility-mgmt';
import { fetchPlants } from '@/server/actions/plant-mgmt';
import { PlantStatusList } from "@/components/dashboard/PlantStatusList";
import { NutrientCalculatorModal } from "@/components/nutrients/NutrientCalculatorModal";
import { SensorStatusBanner, type SensorStatus } from "@/components/dashboard/SensorStatusBanner";
import { StartGrowModal } from "@/components/dashboard/StartGrowModal";
import { ActionCenter } from "@/components/dashboard/ActionCenter";
import type { Plant } from "@/types/plant";
import { RoomSummary } from "@/components/rooms/RoomSummary";
import { deleteRoom } from "@/server/actions/facility-mgmt";

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
    roomClimateReadings: Record<string, any>;
    lightsByRoom: Record<string, any[]>;
  };
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const { setData } = useTelemetry();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState<Plant[]>(initialData.plants);
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState(false);
  const [isStartGrowModalOpen, setIsStartGrowModalOpen] = useState(false);
  const hasLoaded = useRef(false);
  const [toast, setToast] = useState<{ type: "success"; message: string } | null>(null);
  const searchParams = useSearchParams();
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>(initialData.rooms);

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

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (
      !confirm(
        `Delete "${roomName}"? This will unassign all plants and batches in this room.`,
      )
    )
      return;

    setDeletingRoomId(roomId);
    const result = await deleteRoom(roomId);
    setDeletingRoomId(null);

    if (result.success) {
      loadData(true);
    } else {
      alert(result.error || "Failed to delete room");
    }
  };

  const loadData = useCallback(
    async (skipLoading = false) => {
      try {
        if (!skipLoading) setLoading(true);

        const [dashboardData, roomsData, plantsData, readings] = await Promise.all([
          getDashboardData(),
          fetchRooms(),
          fetchPlants(),
          getLatestRoomReadings(),
        ]);

        setPlants(plantsData as any);
        setRooms(roomsData);

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

      {/* Room Summaries */}
      {rooms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room: any) => {
            const plantCount = plants.filter((p) => p.roomId === room.id).length;
            return (
              <RoomSummary
                key={room.id}
                room={room}
                plantCount={plantCount}
                latestReading={initialData.roomClimateReadings[room.id] || null}
                lights={initialData.lightsByRoom?.[room.id] || []}
                variant="card"
                onDelete={handleDeleteRoom}
                isDeleting={deletingRoomId === room.id}
              />
            );
          })}
        </div>
      )}

      {/* Plant Status (cockpit) - with failsafe empty state */}
      {plants.length > 0 ? (
        <PlantStatusList
          plants={plants}
          isLoading={loading}
          onRefresh={() => loadData(true)}
          lastRefreshTime={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm text-center">
          <div className="size-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-4">
            <Sprout className="size-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Welcome to Cultivator's Ledger
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
            You don't have any active grows right now. Start your first seedling to unlock the dashboard, log readings, and track your dryback.
          </p>
          <button
            onClick={() => setIsStartGrowModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors shadow-md"
          >
            <Sprout className="size-5" />
            Start Your First Grow
          </button>
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