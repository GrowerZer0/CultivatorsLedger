"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Grid, List, Plus, Sprout } from "lucide-react";
import { AddPlantModal } from "@/components/plants/AddPlantModal";
import { deletePlant } from "@/server/actions/plant-mgmt";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Plant } from "@/types/plant";
import { PlantSummary } from "@/components/plants/PlantSummary";
import { stageLabel as getStageLabel, weekLabel as getWeekLabel } from "@/lib/stage-label";

type Room = { id: string; name: string };
type Batch = { id: string; name: string };

interface PlantsClientProps {
  initialPlants: Plant[];
  rooms: Room[];
  batches: Batch[];
}

export function PlantsClient({ initialPlants, rooms, batches }: PlantsClientProps) {
  const router = useRouter();
  const [plants, setPlants] = useState(initialPlants);
  useEffect(() => {
    setPlants(initialPlants);
  }, [initialPlants]);
  const [search, setSearch] = useState("");
  const [filterRoom, setFilterRoom] = useState<string>("");
  const [filterBatch, setFilterBatch] = useState<string>("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [addPlantOpen, setAddPlantOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePlant = async (plantId: string, plantName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete "${plantName}"? This will permanently delete the plant and its associated data.`
    );

    if (!confirmed) return;

    setDeletingId(plantId);
    const result = await deletePlant(plantId);
    setDeletingId(null);

    if (!result.success) {
      alert(result.error);
      return;
    }

    setPlants((current) => current.filter((plant) => plant.id !== plantId));
  };

  const filteredPlants = useMemo(() => {
    return plants.filter((plant) => {
      const matchesSearch = plant.name.toLowerCase().includes(search.toLowerCase()) ||
        (plant.strain && plant.strain.toLowerCase().includes(search.toLowerCase()));
      const matchesRoom = filterRoom ? plant.roomId === filterRoom : true;
      const matchesBatch = filterBatch ? plant.batchId === filterBatch : true;
      return matchesSearch && matchesRoom && matchesBatch;
    });
  }, [plants, search, filterRoom, filterBatch]);

  const roomMap = useMemo(() => {
    const map: Record<string, string> = {};
    rooms.forEach((r) => { map[r.id] = r.name; });
    return map;
  }, [rooms]);

  const batchMap = useMemo(() => {
    const map: Record<string, string> = {};
    batches.forEach((b) => { map[b.id] = b.name; });
    return map;
  }, [batches]);

  if (plants.length === 0) {
    return (
      <>
        <EmptyState
          icon={Sprout}
          title="No plants yet."
          description="Add your first plant to start tracking."
          action={{
            label: "Add Your First Plant",
            onClick: () => setAddPlantOpen(true),
          }}
        />
        <AddPlantModal
          open={addPlantOpen}
          onClose={() => setAddPlantOpen(false)}
          rooms={rooms}
          batches={batches}
          hideSelectExisting={true}
          onPlantCreated={() => {
            setAddPlantOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setAddPlantOpen(true)}
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="size-4 mr-2" />
          Add Plant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search plants or strains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Rooms</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>

        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Batches</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>{batch.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setView("grid")}
            className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-300"}`}
          >
            <Grid className="size-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-300"}`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Showing {filteredPlants.length} of {plants.length} plants
      </p>

      {/* Plant List/Grid */}
      {view === "list" ? (
        <div className="divide-y divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {filteredPlants.map((plant) => {
            // compute display values per plant
            const latest = plant.dryBackLogs?.[0];
            const currentWeight = latest ? Number(latest.currentWeightLbs) : plant.currentWeight;
            const useGrams = plant.stage === "seedling";
            const weightDisplay = currentWeight === null || currentWeight === undefined ? "—"
              : useGrams ? `${(Number(currentWeight) * 453.592).toFixed(1)} g`
                : `${Number(currentWeight).toFixed(2)} lbs`;
            const minutesAgo = latest?.timestamp
              ? Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 60000)
              : null;
            const wet = plant.wetWeight;
            const dryback = wet && currentWeight ? Math.max(0, ((Number(wet) - Number(currentWeight)) / Number(wet)) * 100) : null;
            const fcDisplay = wet === null ? null : useGrams ? `FC ${(Number(wet) * 453.592).toFixed(1)} g` : `FC ${Number(wet).toFixed(2)} lbs`;
            const stageLabel = getStageLabel(plant.stage);
            const weekLabel = getWeekLabel(plant.stage, plant.currentStageStartedAt);
            return (
              <PlantSummary
                key={plant.id}
                plant={plant as any}
                latestWeight={currentWeight ?? null}
                latestReadingMinutesAgo={minutesAgo}
                drybackPercent={dryback}
                stageLabel={stageLabel}
                weekLabel={weekLabel}
                weightDisplay={weightDisplay}
                fcDisplay={fcDisplay}
                useGrams={useGrams}
                thumbnailUrl={plant.thumbnailUrl}
                variant="row"
              />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlants.map((plant) => {
            // same computations as above
            const latest = plant.dryBackLogs?.[0];
            const currentWeight = latest ? Number(latest.currentWeightLbs) : plant.currentWeight;
            const useGrams = plant.stage === "seedling";
            const weightDisplay = currentWeight === null || currentWeight === undefined ? "—"
              : useGrams ? `${(Number(currentWeight) * 453.592).toFixed(1)} g`
                : `${Number(currentWeight).toFixed(2)} lbs`;
            const minutesAgo = latest?.timestamp
              ? Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 60000)
              : null;
            const wet = plant.wetWeight;
            const dryback = wet && currentWeight ? Math.max(0, ((Number(wet) - Number(currentWeight)) / Number(wet)) * 100) : null;
            const fcDisplay = wet === null ? null : useGrams ? `FC ${(Number(wet) * 453.592).toFixed(1)} g` : `FC ${Number(wet).toFixed(2)} lbs`;
            const stageLabel = getStageLabel(plant.stage);
            const weekLabel = getWeekLabel(plant.stage, plant.currentStageStartedAt);

            return (
              <PlantSummary
                key={plant.id}
                plant={plant as any}
                latestWeight={currentWeight ?? null}
                latestReadingMinutesAgo={minutesAgo}
                drybackPercent={dryback}
                stageLabel={stageLabel}
                weekLabel={weekLabel}
                weightDisplay={weightDisplay}
                fcDisplay={fcDisplay}
                useGrams={useGrams}
                thumbnailUrl={plant.thumbnailUrl}
                variant="card"
              />
            );
          })}
        </div>
      )}

      <AddPlantModal
        open={addPlantOpen}
        onClose={() => setAddPlantOpen(false)}
        rooms={rooms}
        batches={batches}
        hideSelectExisting={true}
        onPlantCreated={(
        ) => {
          setAddPlantOpen(false);
        }}
      />
    </div>
  );
}
