"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, Grid, List, Plus, Trash2 } from "lucide-react";
import { AddPlantModal } from "@/components/facility/AddPlantModal";
import { deletePlant } from "@/server/actions/plant-mgmt";

type Plant = {
  id: string;
  name: string;
  strain: string | null;
  roomId: string | null;
  batchId: string | null;
  wetWeight: number | null;
  dryTarget: number | null;
  containerGallons: number | null;
  currentWeight: number | null;
};

type Room = { id: string; name: string };
type Batch = { id: string; name: string };

interface PlantsClientProps {
  initialPlants: Plant[];
  rooms: Room[];
  batches: Batch[];
}

export function PlantsClient({ initialPlants, rooms, batches }: PlantsClientProps) {
  const [plants, setPlants] = useState(initialPlants);
  const [search, setSearch] = useState("");
  const [filterRoom, setFilterRoom] = useState<string>("");
  const [filterBatch, setFilterBatch] = useState<string>("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [addPlantOpen, setAddPlantOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePlant = async (plantId: string, plantName: string, e: React.MouseEvent) => {
    // Stop the click from bubbling up to the Link
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
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
            No plants yet.
          </h2>
          <p className="mt-2 text-gray-500 dark:text-zinc-400 max-w-md">
            Add your first plant to start tracking.
          </p>
          <button
            onClick={() => setAddPlantOpen(true)}
            className="mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="size-4 mr-2" />
            Add Your First Plant
          </button>
        </div>
        <AddPlantModal
          open={addPlantOpen}
          onClose={() => setAddPlantOpen(false)}
          rooms={rooms}
          onPlantCreated={(plant) => {
            setPlants((current) => [
              ...current,
              {
                id: plant.id,
                name: plant.name,
                strain: null,
                roomId: plant.roomId ?? null,
                batchId: null,
                wetWeight: null,
                dryTarget: null,
                containerGallons: null,
                currentWeight: null,
              },
            ]);
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
      <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search plants or strains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Rooms</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>

        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Batches</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>{batch.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setView("grid")}
            className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <Grid className="size-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
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
        <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
          {filteredPlants.map((plant) => {
            const roomName = plant.roomId ? roomMap[plant.roomId] : "No Room";
            const batchName = plant.batchId ? batchMap[plant.batchId] : "No Batch";
            return (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-800/70 transition-colors cursor-pointer group"
              >
                <div>
                  <p className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                    {plant.name}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400 mt-0.5">
                    <span>{plant.strain || "Unknown strain"}</span>
                    <span>•</span>
                    <span className="text-emerald-400">{roomName}</span>
                    <span>•</span>
                    <span className="text-blue-400">{batchName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  {plant.currentWeight !== null && (
                    <span>Current: {Number(plant.currentWeight).toFixed(1)} lbs</span>
                  )}
                  <div className="flex items-center gap-3">
                    {plant.roomId && (
                      <Link
                        href={`/rooms/${plant.roomId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-400 hover:underline"
                      >
                        View Room
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeletePlant(plant.id, plant.name, e)}
                      disabled={deletingId === plant.id}
                      className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      title="Delete plant"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlants.map((plant) => {
            const roomName = plant.roomId ? roomMap[plant.roomId] : "No Room";
            return (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-emerald-500 hover:bg-zinc-800/70 transition-all group cursor-pointer"
              >
                <p className="font-medium text-white group-hover:text-emerald-400 truncate transition-colors">
                  {plant.name}
                </p>
                <p className="text-xs text-zinc-400 truncate">{plant.strain || "Unknown strain"}</p>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-emerald-400">{roomName}</span>
                  <span className="text-blue-400">{plant.batchId ? "In batch" : "No batch"}</span>
                </div>
                {plant.currentWeight !== null && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Current: {Number(plant.currentWeight).toFixed(1)} lbs
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {plant.roomId && (
                    <Link
                      href={`/rooms/${plant.roomId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      View Room →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleDeletePlant(plant.id, plant.name, e)}
                    disabled={deletingId === plant.id}
                    className="text-red-400 hover:text-red-300 transition-colors ml-auto disabled:opacity-50"
                    title="Delete plant"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AddPlantModal
        open={addPlantOpen}
        onClose={() => setAddPlantOpen(false)}
        rooms={rooms}
        onPlantCreated={(plant) => {
          setPlants((current) => [
            ...current,
            {
              id: plant.id,
              name: plant.name,
              strain: null,
              roomId: plant.roomId ?? null,
              batchId: null,
              wetWeight: null,
              dryTarget: null,
              containerGallons: null,
              currentWeight: null,
            },
          ]);
          setAddPlantOpen(false);
        }}
      />
    </div>
  );
}
