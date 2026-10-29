"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Scale,
  Calendar,
  Droplet,
  Sprout,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Camera,
  ArrowRight,
  Scissors,
} from "lucide-react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { deletePlant } from "@/server/actions/plant-mgmt";
import { EditPlantModal } from "@/components/facility/EditPlantModal";
import { GROWTH_STAGES, getStageFromDays, getStageProgress } from "@/lib/growth-stages";
import type { PlantWithDetails, DryBackLog, IrrigationEvent } from "@/types/plant";
import { PhotoUploadModal } from "@/components/photos/PhotoUploadModal";
import { SeedlingTracker } from "./SeedlingTracker";
import { AdvanceStageModal } from "./AdvanceStageModal";
import { Light } from "@prisma/client";
import { DryCureTracker } from "./DryCureTracker";
import { CultivationDashboard } from "@/components/plant/CultivationDashboard";

interface PlantDetailClientProps {
  plant: PlantWithDetails;
  seedlingContext?: any;
  lights?: Light[];
    latestClimate?: { vpd: number; humidity: number; temperatureF: number } | null;
}

export function PlantDetailClient({ plant, seedlingContext, lights, latestClimate }: PlantDetailClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPlant, setCurrentPlant] = useState(plant);
  // Sync the local state with the server whenever the page refreshes
  useEffect(() => {
    setCurrentPlant(plant);
  }, [plant]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isAdvanceStageOpen, setIsAdvanceStageOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${plant.name}"? This will permanently delete the plant and all its data.`)) return;

    setIsDeleting(true);
    const result = await deletePlant(plant.id);
    setIsDeleting(false);

    if (result.success) {
      router.push("/plants");
    } else {
      alert(result.error || "Failed to delete plant");
    }
  };

  const handlePlantUpdated = (updatedPlant: any) => {
    // Merge updated plant data with existing structure
    setCurrentPlant({
      ...currentPlant,
      ...updatedPlant,
      // Ensure arrays exist
      dryBackLogs: currentPlant.dryBackLogs || [],
      irrigationEvents: currentPlant.irrigationEvents || [],
      plantInsights: currentPlant.plantInsights || [],
    });
    setShowEditModal(false);
    router.refresh();
  };

  // Safe access with fallbacks
  const dryBackLogs = currentPlant?.dryBackLogs || [];
  const irrigationEvents = currentPlant?.irrigationEvents || [];
  const plantInsights = currentPlant?.plantInsights || [];

  const latestLog = dryBackLogs[0];
  const weight = latestLog?.currentWeightLbs ?? null;
  const dryback = latestLog?.dryBackPercent ?? null;

  const daysSinceStart = currentPlant?.startDate
    ? Math.floor((Date.now() - new Date(currentPlant.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Growth Stage
  const detectedStage = currentPlant?.stage || getStageFromDays(daysSinceStart);
  const stageConfig = GROWTH_STAGES[detectedStage as keyof typeof GROWTH_STAGES];
  // Calculate days in the CURRENT stage
  let daysInCurrentStage = 0;
  if (detectedStage === "flowering" && currentPlant.flipDate) {
    daysInCurrentStage = Math.floor((Date.now() - new Date(currentPlant.flipDate).getTime()) / (1000 * 60 * 60 * 24));
  } else if (detectedStage === "dry" || detectedStage === "cure") {
    // Fallback: use updatedAt since that's when the stage last changed
    daysInCurrentStage = Math.floor((Date.now() - new Date(currentPlant.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  } else if (currentPlant.startDate) {
    daysInCurrentStage = Math.floor((Date.now() - new Date(currentPlant.startDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  const isStandardStage = ["seedling", "vegetative", "flowering"].includes(detectedStage?.toLowerCase() || "");
  
  const stageProgress = isStandardStage 
    ? getStageProgress(daysSinceStart, detectedStage as any) 
    : getStageProgress(daysSinceStart, detectedStage as any, daysInCurrentStage);
  // Calculate dryback trend
  const getTrend = () => {
    if (dryBackLogs.length < 3) return null;
    const recent = dryBackLogs.slice(0, 3);
    const older = dryBackLogs.slice(3, 6);
    if (older.length === 0) return null;

    const recentAvg = recent.reduce((sum, l) => sum + l.dryBackPercent, 0) / recent.length;
    const olderAvg = older.reduce((sum, l) => sum + l.dryBackPercent, 0) / older.length;
    const diff = recentAvg - olderAvg;

    if (diff > 5) return { direction: "up", label: "Increasing", icon: TrendingUp };
    if (diff < -5) return { direction: "down", label: "Decreasing", icon: TrendingDown };
    return { direction: "stable", label: "Stable", icon: Minus };
  };

  const trend = getTrend();

  // Combine events for timeline
  const allEvents = [
    ...dryBackLogs.map((log) => ({ kind: "weight" as const, data: log, timestamp: new Date(log.timestamp) })),
    ...irrigationEvents.map((e) => ({ kind: "irrigation" as const, data: e, timestamp: new Date(e.timestamp) })),
    ...(currentPlant.photos || []).map((p) => ({ kind: "photo" as const, data: p, timestamp: new Date(p.capturedAt) })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Chart data: dryback % over the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const dryBackChartData = dryBackLogs
    .filter((log) => new Date(log.timestamp).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((log) => ({
      time: new Date(log.timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      dryback: Number(log.dryBackPercent),
    }));

  // Fetch all plants and batches for the edit modal
  const [allPlants, setAllPlants] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [allRooms, setAllRooms] = useState<any[]>([]);

  const handleOpenEdit = async () => {
    setIsLoadingData(true);
    try {
      const [plantsRes, batchesRes, roomsRes] = await Promise.all([
        fetch('/api/plants'),
        fetch('/api/batches'),
        fetch('/api/rooms'),
      ]);
      const plantsData = await plantsRes.json();
      const batchesData = await batchesRes.json();
      const roomsData = await roomsRes.json();
      setAllPlants(plantsData);
      setAllBatches(batchesData);
      setAllRooms(roomsData);
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load data for edit:', error);
      setShowEditModal(true);
    } finally {
      setIsLoadingData(false);
    }
  };

  const rooms = currentPlant?.room ? [{ id: currentPlant.room.id, name: currentPlant.room.name }] : [];
    // Calculate the current week based on the stage and start date
  let currentWeek = 1;
  if (detectedStage === "vegetative" && currentPlant.startDate) {
    const days = Math.floor((Date.now() - new Date(currentPlant.startDate).getTime()) / (1000 * 60 * 60 * 24));
    currentWeek = Math.floor(days / 7) + 1;
  } else if (detectedStage === "flowering" && currentPlant.flipDate) {
    const days = Math.floor((Date.now() - new Date(currentPlant.flipDate).getTime()) / (1000 * 60 * 60 * 24));
    currentWeek = Math.floor(days / 7) + 1;
  } else if (currentPlant.stageEvents?.[0]) {
    // Fallback for dry/cure using the StageEvent timestamp
    const days = Math.floor((Date.now() - new Date((currentPlant as any).stageEvents[0].startedAt).getTime()) / (1000 * 60 * 60 * 24));
    currentWeek = Math.floor(days / 7) + 1;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/plants"
            className="p-2 rounded-lg hover:bg-zinc-100 dark:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{currentPlant?.name || 'Plant'}</h1>
            {currentPlant?.strain && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{currentPlant.strain}</p>
            )}
            {currentPlant?.light && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-900/50">
                💡 {currentPlant.light.wattage}W @ {currentPlant.light.dimmerPercent}%
                {currentPlant.light.distanceInches ? ` · ${currentPlant.light.distanceInches}" away` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenEdit}
            className="px-3 py-1.5 text-xs font-bold bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
          <button
            onClick={() => setIsAdvanceStageOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <ArrowRight className="size-3.5" />
            Advance Stage
          </button>
          <button
            onClick={() => router.push(`/check-in?plantId=${currentPlant?.id}`)}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            Log Reading
          </button>
          <button
            onClick={() => setIsPhotoModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Camera className="size-3.5" />
            Add Photo
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Seedling Tracker */}
      {currentPlant?.stage === "seedling" && (
        <div className="mb-6">
          <SeedlingTracker
            plantId={currentPlant.id}
            lastPlugWeight={seedlingContext?.lastCheck?.plugWeightG || null}
            light={currentPlant.light}
          />
        </div>
      )}

      {/* Dry / Cure Tracker */}
      {["dry", "cure"].includes(currentPlant?.stage || "") && (
        <div className="mb-6">
          <DryCureTracker
            plantId={currentPlant.id}
            stage={currentPlant.stage!}
            lastWeight={null} 
          />
        </div>
      )}
      {currentPlant.stage === "dry" && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
            <Scissors className="size-4" /> Plant is Drying
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            Target: 60°F / 60% RH. Wait for the stems to snap before curing.
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs">
            <Scale className="size-4" />
            Current Weight
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {weight !== null ? `${Number(weight).toFixed(1)} lbs` : "—"}
          </div>
          {currentPlant?.wetWeight && (
            <div className="text-xs text-zinc-500">
              Wet: {Number(currentPlant.wetWeight).toFixed(1)} lbs
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs">
            <Activity className="size-4" />
            Dryback
          </div>
          <div className={`text-2xl font-bold mt-1 ${dryback !== null ? (
            dryback > 80 ? 'text-red-500' :
              dryback > 60 ? 'text-yellow-500' :
                'text-green-500'
          ) : 'text-white'
            }`}>
            {dryback !== null ? `${Number(dryback).toFixed(1)}%` : "—"}
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              <trend.icon className={`size-3 ${trend.direction === 'up' ? 'text-yellow-500' :
                trend.direction === 'down' ? 'text-green-500' :
                  'text-zinc-500'
                }`} />
              <span className="text-zinc-600 dark:text-zinc-400">{trend.label}</span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs">
            <Calendar className="size-4" />
            Days in Grow
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {daysSinceStart > 0 ? daysSinceStart : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            Since {currentPlant?.startDate ? new Date(currentPlant.startDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs">
            <Sprout className="size-4" />
            Growth Stage
          </div>
          <div className="text-2xl font-bold mt-1">
            <span className={stageConfig?.color || 'text-white'}>
              {stageConfig?.icon || '🌱'} {stageConfig?.label || 'Unknown'}
            </span>
          </div>
          <div className="text-xs text-zinc-500">
            {Math.round(stageProgress)}% through stage
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-xs">
            <Droplet className="size-4" />
            Logs
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {dryBackLogs.length}
          </div>
          <div className="text-xs text-zinc-500">
            {irrigationEvents.length} irrigations
          </div>
        </div>
      </div>

      {/* Dynamic Cultivation Dashboard */}
      <CultivationDashboard 
        stage={(detectedStage as any) || "seedling"}
        week={currentWeek}
        substrate={currentPlant.substrate || "happy_frog"}
        nutrientLine={currentPlant.nutrientLine || "gh_flora"}
        currentVpd={latestClimate?.vpd}
      />

      {/* Room & Batch Info */}
      {(currentPlant?.room || currentPlant?.batch) && (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-wrap gap-4">
          {currentPlant?.room && (
            <div>
              <span className="text-xs text-zinc-500">Room</span>
              <Link href={`/rooms/${currentPlant.room.id}`} className="block text-sm text-emerald-400 hover:underline">
                {currentPlant.room.name}
              </Link>
            </div>
          )}
          {currentPlant?.batch && (
            <div>
              <span className="text-xs text-zinc-500">Batch</span>
              <Link href={`/batches/${currentPlant.batch.id}`} className="block text-sm text-emerald-400 hover:underline">
                {currentPlant.batch.name}
              </Link>
            </div>
          )}
          {currentPlant?.containerGallons && (
            <div>
              <span className="text-xs text-zinc-500">Container</span>
              <div className="text-sm text-zinc-900 dark:text-white">{currentPlant.containerGallons} gal</div>
            </div>
          )}
          {currentPlant?.dryTarget && (
            <div>
              <span className="text-xs text-zinc-500">Dry Target</span>
              <div className="text-sm text-zinc-900 dark:text-white">{Number(currentPlant.dryTarget).toFixed(1)} lbs</div>
            </div>
          )}
          {currentPlant?.mirrorPlant && (
            <div>
              <span className="text-xs text-zinc-500">Mirroring</span>
              <Link href={`/plants/${currentPlant.mirrorPlant.id}`} className="block text-sm text-emerald-400 hover:underline">
                {currentPlant.mirrorPlant.name}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Dry-Back Trend Chart (last 7 days) */}
      {dryBackChartData.length > 1 && (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Dry-Back Trend</h2>
              <p className="text-[10px] text-zinc-500">Last 7 days</p>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {dryBackChartData.length} points
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dryBackChartData}
                margin={{ top: 5, right: 5, bottom: 5, left: -25 }}
              >
                <CartesianGrid stroke="#1F2937" className="opacity-40" strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  stroke="#4B5563"
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#4B5563"
                  fontSize={10}
                  tickLine={false}
                  domain={[0, 'auto']}
                  label={{
                    value: 'Dryback %',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#9CA3AF',
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Dryback']} />
                <Line
                  type="monotone"
                  dataKey="dryback"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />

                {/* Irrigation markers */}
                {irrigationEvents
                  .filter((e) => new Date(e.timestamp).getTime() >= sevenDaysAgo)
                  .map((e) => {
                    const isoMatch = dryBackChartData.find(
                      (d) =>
                        Math.abs(
                          new Date(d.time).getTime() - new Date(e.timestamp).getTime()
                        ) < 5 * 60 * 1000
                    );
                    if (!isoMatch) return null;
                    return (
                      <ReferenceLine
                        key={`irrigation-${e.id}`}
                        x={isoMatch.time}
                        stroke="#3b82f6"
                        strokeDasharray="3 3"
                        label={{
                          value: "💧",
                          position: "top",
                          fontSize: 14,
                        }}
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Show message if no data in the last 7 days */}
      {dryBackChartData.length === 0 && dryBackLogs.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-xs text-zinc-500">
            No dryback readings in the last 7 days.
          </p>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Activity Timeline</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {allEvents.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <p>No activity logged yet.</p>
              <p className="text-xs mt-1">Start by logging a check-in or importing data.</p>
            </div>
          ) : (
            allEvents.slice(0, 3).map((event, index) => {
              const date = event.timestamp;

              // ---- PHOTO ----
              if (event.kind === "photo") {
                const photo = event.data;
                return (
                  <button
                    key={`photo-${photo.id}-${index}`}
                    onClick={() => {
                      if (photo.url) window.open(photo.url, "_blank");
                    }}
                    className="w-full p-4 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors text-left"
                  >
                    <div className="shrink-0">
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={photo.note || "Plant photo"}
                          className="size-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <div className="size-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Camera className="size-6 text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 dark:text-white text-sm">
                          Photo
                          {photo.stageAtCapture && (
                            <span className="ml-2 text-xs text-zinc-500 capitalize">
                              {photo.stageAtCapture}
                              {photo.weekOfStage ? ` · Week ${photo.weekOfStage}` : ""}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {date.toLocaleDateString()}{" "}
                          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {photo.note && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                          {photo.note}
                        </p>
                      )}
                      {photo.weightAtCapture !== null && (
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Weight at capture: {Number(photo.weightAtCapture).toFixed(2)} lbs
                        </p>
                      )}
                    </div>
                  </button>
                );
              }

              // ---- WEIGHT ----
              if (event.kind === "weight") {
                const log = event.data;
                return (
                  <div
                    key={`weight-${log.id}-${index}`}
                    className="p-4 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Scale className="size-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {Number(log.currentWeightLbs).toFixed(1)} lbs
                          <span
                            className={`ml-2 text-xs ${Number(log.dryBackPercent) > 80
                              ? "text-red-500"
                              : Number(log.dryBackPercent) > 60
                                ? "text-amber-500"
                                : "text-emerald-500"
                              }`}
                          >
                            ({Number(log.dryBackPercent).toFixed(1)}% dryback)
                          </span>
                        </span>
                        <span className="text-xs text-zinc-500">
                          {date.toLocaleDateString()}{" "}
                          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {log.trainingEvent && log.trainingEvent !== "None" && (
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                          Training: {log.trainingEvent}
                        </div>
                      )}
                      {log.notes && (
                        <div className="text-xs text-zinc-500 mt-0.5 truncate">{log.notes}</div>
                      )}
                    </div>
                  </div>
                );
              }

              // ---- IRRIGATION ----
              if (event.kind === "irrigation") {
                const irrigation = event.data;
                return (
                  <div
                    key={`irrigation-${irrigation.id}-${index}`}
                    className="p-4 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Droplet className="size-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          Irrigation
                          {irrigation.moisturePercentage !== null && (
                            <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">
                              ({Number(irrigation.moisturePercentage).toFixed(0)}% moisture)
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {date.toLocaleDateString()}{" "}
                          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {irrigation.notes && (
                        <div className="text-xs text-zinc-500 mt-0.5 truncate">
                          {irrigation.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })
          )}
        </div>
      </div>

      {/* AI Insights */}
      {plantInsights.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">AI Insights</h2>
          <div className="space-y-2">
            {plantInsights.slice(0, 3).map((insight) => (
              <div key={insight.id} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-300 dark:border-zinc-700/50">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${insight.recommendationType === 'irrigate' ? 'bg-red-500/20 text-red-400' :
                    insight.recommendationType === 'wait' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                    {insight.recommendationType}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(insight.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{insight.recommendationText}</p>
                {insight.actionPlan && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{insight.actionPlan}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditPlantModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        plant={currentPlant}
        rooms={allRooms.length > 0 ? allRooms : rooms}
        batches={allBatches}
        lights={lights}
        allPlants={allPlants}
        onPlantUpdated={handlePlantUpdated}
      />
      <PhotoUploadModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        plantId={currentPlant.id}
        plantName={currentPlant.name}
      />
      <AdvanceStageModal
        isOpen={isAdvanceStageOpen}
        onClose={() => setIsAdvanceStageOpen(false)}
        plantId={currentPlant.id}
        currentStage={currentPlant.stage || "seedling"}
        lightName={currentPlant.light?.name}
      />
    </div>
  );
}
