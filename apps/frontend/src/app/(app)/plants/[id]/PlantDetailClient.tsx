"use client";

import { useState } from "react";
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
} from "lucide-react";
import { deletePlant } from "@/server/actions/plant-mgmt";
import { EditPlantModal } from "@/components/facility/EditPlantModal";
import { GROWTH_STAGES, getStageFromDays, getStageProgress } from "@/lib/growth-stages";
import type { PlantWithDetails, DryBackLog, IrrigationEvent, PlantInsight } from "@/types/plant";

interface PlantDetailClientProps {
  plant: PlantWithDetails;
}

export function PlantDetailClient({ plant }: PlantDetailClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPlant, setCurrentPlant] = useState(plant);

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
  const stageProgress = getStageProgress(daysSinceStart, detectedStage as any);

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
  const allEvents = [...dryBackLogs, ...irrigationEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

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

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/plants"
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{currentPlant?.name || 'Plant'}</h1>
            {currentPlant?.strain && (
              <p className="text-sm text-zinc-400">{currentPlant.strain}</p>
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
            onClick={() => router.push(`/check-in?plantId=${currentPlant?.id}`)}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            Log Check-in
          </button>
          <button
  onClick={async () => {
    const defaultWeight = currentPlant.currentWeight ? Number(currentPlant.currentWeight).toFixed(2) : '';
    const input = window.prompt(`Set field capacity for ${currentPlant.name}.\n\nEnter the new wet weight (lbs):`, defaultWeight);
    if (input === null) return;
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) return;
    const res = await fetch(`/api/plants/${currentPlant.id}/set-fc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: val }),
    });
    if (res.ok) router.refresh();
    else alert('Failed to set FC');
  }}
  className="px-3 py-1.5 text-xs font-bold bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
>
  Set FC
</button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Scale className="size-4" />
            Current Weight
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {weight !== null ? `${weight.toFixed(1)} lbs` : "—"}
          </div>
          {currentPlant?.wetWeight && (
            <div className="text-xs text-zinc-500">
              Wet: {currentPlant.wetWeight.toFixed(1)} lbs
            </div>
          )}
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Activity className="size-4" />
            Dryback
          </div>
          <div className={`text-2xl font-bold mt-1 ${
            dryback !== null ? (
              dryback > 80 ? 'text-red-500' :
              dryback > 60 ? 'text-yellow-500' :
              'text-green-500'
            ) : 'text-white'
          }`}>
            {dryback !== null ? `${dryback.toFixed(1)}%` : "—"}
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              <trend.icon className={`size-3 ${
                trend.direction === 'up' ? 'text-yellow-500' :
                trend.direction === 'down' ? 'text-green-500' :
                'text-zinc-500'
              }`} />
              <span className="text-zinc-400">{trend.label}</span>
            </div>
          )}
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Calendar className="size-4" />
            Days in Grow
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {daysSinceStart > 0 ? daysSinceStart : "—"}
          </div>
          <div className="text-xs text-zinc-500">
            Since {currentPlant?.startDate ? new Date(currentPlant.startDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
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

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Droplet className="size-4" />
            Logs
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {dryBackLogs.length}
          </div>
          <div className="text-xs text-zinc-500">
            {irrigationEvents.length} irrigations
          </div>
        </div>
      </div>

      {/* Room & Batch Info */}
      {(currentPlant?.room || currentPlant?.batch) && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-wrap gap-4">
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
              <div className="text-sm text-white">{currentPlant.containerGallons} gal</div>
            </div>
          )}
          {currentPlant?.dryTarget && (
            <div>
              <span className="text-xs text-zinc-500">Dry Target</span>
              <div className="text-sm text-white">{currentPlant.dryTarget.toFixed(1)} lbs</div>
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

      {/* Activity Timeline */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-300">Activity Timeline</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {allEvents.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <p>No activity logged yet.</p>
              <p className="text-xs mt-1">Start by logging a check-in or importing data.</p>
            </div>
          ) : (
            allEvents.slice(0, 20).map((event, index) => {
              const isWeight = 'currentWeightLbs' in event && event.currentWeightLbs !== null;
              const date = new Date(event.timestamp);
              const log = event as DryBackLog;
              const irrigation = event as IrrigationEvent;
              
              return (
                <div key={`${isWeight ? 'weight' : 'irrigation'}-${event.id}-${index}`} className="p-4 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {isWeight ? (
                      <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        <Scale className="size-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-400">
                        <Droplet className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        {isWeight ? (
                          <span className="font-medium text-white">
                            {log.currentWeightLbs.toFixed(1)} lbs
                            <span className={`ml-2 text-xs ${
                              log.dryBackPercent > 80 ? 'text-red-400' :
                              log.dryBackPercent > 60 ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              ({log.dryBackPercent.toFixed(1)}% dryback)
                            </span>
                          </span>
                        ) : (
                          <span className="font-medium text-white">
                            Irrigation
                            {irrigation.moisturePercentage !== null && (
                              <span className="ml-2 text-xs text-zinc-400">
                                ({irrigation.moisturePercentage.toFixed(0)}% moisture)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {isWeight && log.trainingEvent && log.trainingEvent !== "None" && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Training: {log.trainingEvent}
                      </div>
                    )}
                    {event.notes && (
                      <div className="text-xs text-zinc-500 mt-0.5 truncate">
                        {event.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* AI Insights */}
      {plantInsights.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-zinc-300 mb-3">AI Insights</h2>
          <div className="space-y-2">
            {plantInsights.slice(0, 3).map((insight) => (
              <div key={insight.id} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/50">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    insight.recommendationType === 'irrigate' ? 'bg-red-500/20 text-red-400' :
                    insight.recommendationType === 'wait' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {insight.recommendationType}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(insight.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 mt-1">{insight.recommendationText}</p>
                {insight.actionPlan && (
                  <p className="text-xs text-zinc-400 mt-1">{insight.actionPlan}</p>
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
  allPlants={allPlants}
  onPlantUpdated={handlePlantUpdated}
/>
    </div>
  );
}
