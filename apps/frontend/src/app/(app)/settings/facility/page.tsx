"use client";
import React, { useEffect, useState } from "react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import {
  createPlant,
  deletePlant,
  fetchPlants,
} from "@/app/actions/plant-mgmt";
import {
  createRoom,
  deleteRoom,
  fetchRooms,
} from "@/app/actions/facility-mgmt";
import { fetchBatches } from "@/app/actions/batch-mgmt";
// Types (keep as you have)
interface RoomData {
  id: string;
  name: string;
  type: string;
}
interface BatchData {
  id: string;
  name: string;
  cultivar: string;
  roomId: string | null;
  isActive: boolean;
  wetWeight?: number | null;
  dryTarget?: number | null;
}
interface PlantData {
  id: string;
  name: string;
  strain?: string | null;
  roomId?: string | null;
  batchId?: string | null;
  containerGallons?: number | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
}
export default function FacilityManagementPage() {  // renamed; no props
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [plants, setPlants] = useState<PlantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rooms" | "batches" | "plants">("plants");
  const [newRoomName, setNewRoomName] = useState("");
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantStrain, setNewPlantStrain] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [newPlantWet, setNewPlantWet] = useState("");
  const [newPlantDry, setNewPlantDry] = useState("");
  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [roomsData, batchesData, plantsData] = await Promise.all([
          fetchRooms(),
          fetchBatches(),
          fetchPlants(),
        ]);
        setRooms(roomsData);
        setBatches(
          batchesData.map((batch) => ({
            ...batch,
            wetWeight: batch.wetWeight ? Number(batch.wetWeight) : null,
            dryTarget: batch.dryTarget ? Number(batch.dryTarget) : null,
          }))
        );
        setPlants(plantsData);
        if (roomsData.length > 0) setSelectedRoomId(roomsData[0].id);
      } catch (err) {
        console.error("Failed to load facility data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);
  // Handlers (same as yours)
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName) return;
    const res = await createRoom({ name: newRoomName, type: "tent" });
    if (res.success && res.room) {
      setRooms([...rooms, res.room]);
      setNewRoomName("");
    }
  };
  const handleDeleteRoom = async (id: string) => {
    if (!confirm("Delete this space? All associated plants will unbind.")) return;
    const res = await deleteRoom(id);
    if (res.success) {
      setRooms(rooms.filter((r) => r.id !== id));
    }
  };
  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName) return;
    const res = await createPlant({
      name: newPlantName,
      strain: newPlantStrain || undefined,
      roomId: selectedRoomId || undefined,
      wetWeight: newPlantWet ? parseFloat(newPlantWet) : undefined,
      dryTarget: newPlantDry ? parseFloat(newPlantDry) : undefined,
    });
    if (res.success && res.plant) {
      setPlants([...plants, res.plant as PlantData]);
      setNewPlantName("");
      setNewPlantStrain("");
      setNewPlantWet("");
      setNewPlantDry("");
    }
  };
  const handleDeletePlant = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plant?")) return;
    const res = await deletePlant(id);
    if (res.success) {
      setPlants(plants.filter((p) => p.id !== id));
    }
  };
  if (loading) {
    return <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Loading facility data...</div>;
  }
  return (
    <SectionPanel title="Facility Management">
      <div className="space-y-6">
        <div className="flex border-b border-gray-200 dark:border-zinc-800 pb-2 gap-4">
          <button
            onClick={() => setActiveTab("rooms")}
            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${
              activeTab === "rooms"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400"
            }`}
          >
            Rooms & Tents ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab("batches")}
            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${
              activeTab === "batches"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400"
            }`}
          >
            Batches ({batches.length})
          </button>
          <button
            onClick={() => setActiveTab("plants")}
            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${
              activeTab === "plants"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400"
            }`}
          >
            Plants ({plants.length})
          </button>
        </div>
        {/* PLANTS TAB */}
        {activeTab === "plants" && (
          <div className="space-y-6">
            <form onSubmit={handleAddPlant} className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ... form fields ... */}
            </form>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              {plants.map((plant) => {
                const assignedRoom = rooms.find((r) => r.id === plant.roomId);
                return (
                  <div key={plant.id} className="p-4 flex justify-between items-center bg-white dark:bg-zinc-900">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{plant.name}</h4>
                      <p className="text-xs text-zinc-500">
                        Strain: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{plant.strain || "Unknown"}</span> | Space: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{assignedRoom?.name || "Unassigned"}</span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Targets: {plant.wetWeight ? `${plant.wetWeight} lbs Wet` : "N/A"} / {plant.dryTarget ? `${plant.dryTarget} lbs Dry` : "N/A"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePlant(plant.id)}
                      className="text-xs font-semibold text-red-500 hover:text-red-400 p-2"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
              {plants.length === 0 && (
                <p className="p-4 text-xs text-zinc-500 text-center">No plants registered yet. Add one above.</p>
              )}
            </div>
          </div>
        )}
        {/* ROOMS TAB – same as yours */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <form onSubmit={handleAddRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Main Tent / Tent 1"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="flex-1 text-sm p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
                required
              />
              <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-sm transition-colors">
                + Add Room/Tent
              </button>
            </form>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              {rooms.map((room) => (
                <div key={room.id} className="p-4 flex justify-between items-center bg-white dark:bg-zinc-900">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{room.name}</h4>
                    <p className="text-xs text-zinc-500">Type: {room.type}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="text-xs font-semibold text-red-500 hover:text-red-400 p-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  );
}