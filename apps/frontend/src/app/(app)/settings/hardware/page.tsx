"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, RefreshCw, Wifi, WifiOff, Link2 } from "lucide-react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import {
  getSensors,
  createSensor,
  toggleSensor,
  deleteSensor,
  regenerateApiKey,
  updateSensorAssignment,
} from "@/server/actions/sensorconfig";
import { fetchPlants } from "@/server/actions/plant-mgmt";
import { fetchRooms } from "@/server/actions/facility-mgmt";
import Link from "next/link";
import { AddSensorModal } from "@/components/facility/AddSensorModal";

type Plant = { id: string; name: string };
type Room = { id: string; name: string };

export default function HardwareSettingsPage() {
  const [sensors, setSensors] = useState<any[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingSensors(true);
    try {
      const [sensorsData, plantsData, roomsData] = await Promise.all([
        getSensors(),
        fetchPlants(),
        fetchRooms(),
      ]);
      setSensors(sensorsData || []);
      setPlants((plantsData as any[]) || []);
      setRooms((roomsData as any[]) || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoadingSensors(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggleSensor(id: string, isActive: boolean) {
    try {
      await toggleSensor(id, isActive);
      loadData();
    } catch (error) {
      console.error("Failed to toggle sensor:", error);
    }
  }

  async function handleDeleteSensor(id: string) {
    if (!confirm("Are you sure you want to remove this sensor integration?")) return;
    try {
      await deleteSensor(id);
      loadData();
    } catch (error) {
      console.error("Failed to delete sensor:", error);
    }
  }

  async function handleRegenerateKey(id: string) {
    if (
      !confirm(
        "Regenerating the API key will break active telemetry streams until updated on your hardware. Continue?",
      )
    )
      return;
    try {
      const result = await regenerateApiKey(id);
      loadData();
      if (result.apiKey) {
        setShowApiKey(result.apiKey);
        setTimeout(() => setShowApiKey(null), 10000);
      }
    } catch (error) {
      console.error("Failed to regenerate key:", error);
    }
  }

  // Assign a sensor to a plant or room
  async function handleAssign(
    sensorId: string,
    targetType: "plant" | "room" | "none",
    targetId: string,
  ) {
    setAssigningId(sensorId);
    try {
      if (targetType === "none") {
        // Clear assignment: try plant first, then room (since we don't know which is set)
        await updateSensorAssignment(sensorId, "plant", null);
        await updateSensorAssignment(sensorId, "room", null);
      } else {
        await updateSensorAssignment(sensorId, targetType, targetId);
      }
      await loadData();
    } catch (error) {
      console.error("Failed to assign sensor:", error);
      alert("Failed to assign sensor.");
    } finally {
      setAssigningId(null);
    }
  }

  const getStatusDisplay = (sensor: any) => {
    if (!sensor.lastPingAt) {
      return { label: "Never pinged", color: "text-zinc-500", icon: null };
    }
    const lastPing = new Date(sensor.lastPingAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastPing.getTime()) / (1000 * 60);

    if (diffMinutes < 5) {
      return { label: "Online", color: "text-emerald-400", icon: <Wifi className="size-3" /> };
    } else if (diffMinutes < 60) {
      return {
        label: `Last seen ${Math.round(diffMinutes)}m ago`,
        color: "text-yellow-400",
        icon: <WifiOff className="size-3" />,
      };
    } else {
      return {
        label: `Last seen ${Math.round(diffMinutes / 60)}h ago`,
        color: "text-red-400",
        icon: <WifiOff className="size-3" />,
      };
    }
  };

  // Infer what kinds of targets this sensor can be assigned to
  function getAssignableTargets(sensor: any): "plant" | "room" | "both" {
    const t = (sensor.type || "").toLowerCase();
    if (t.includes("loadcell") || t.includes("load-cell") || t.includes("scale")) {
      return "plant";
    }
    if (t.includes("environmental") || t.includes("sht") || t.includes("climate") || t.includes("temp")) {
      return "room";
    }
    return "both";
  }

  return (
    <SectionPanel title="Hardware & Sensor Controller">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Manage your ESP32 load cells and environmental sensors. Assign them to plants or rooms below.
            </p>
            {showApiKey && (
              <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-400 font-mono">
                  🔑 New API Key: <span className="font-bold">{showApiKey}</span>
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Copy this key now. It won&apos;t be shown again.
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAddSensor(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Device
          </button>
        </div>

        {loadingSensors ? (
          <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">
            Loading devices...
          </div>
        ) : sensors.length === 0 ? (
          <div className="text-xs text-zinc-500 py-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            <p className="font-semibold text-zinc-600 dark:text-zinc-400">
              No hardware devices configured
            </p>
            <p className="mt-1">Add your ESP32 load cell to start receiving weight data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensors.map((sensor) => {
              const status = getStatusDisplay(sensor);
              const assignable = getAssignableTargets(sensor);
              const currentPlantId = sensor.plantId || "";
              const currentRoomId = sensor.roomId || "";
              const currentValue = currentPlantId ? `plant:${currentPlantId}` : currentRoomId ? `room:${currentRoomId}` : "";

              return (
                <div
                  key={sensor.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/settings/hardware/${sensor.id}`}
                        className="hover:underline group"
                      >
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 group-hover:text-emerald-500 transition-colors">
                          {sensor.name}
                          {sensor.type === "esp32-loadcell" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                              Load Cell
                            </span>
                          )}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${status.color} flex items-center gap-1`}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleSensor(sensor.id, !sensor.isActive)}
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        sensor.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {sensor.isActive ? "Active" : "Disabled"}
                    </button>
                  </div>

                  {/* Assignment */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                      <Link2 className="size-3" />
                      Assigned To
                    </label>
                    <select
                      value={currentValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          handleAssign(sensor.id, "none", "");
                        } else {
                          const [type, id] = val.split(":");
                          handleAssign(sensor.id, type as "plant" | "room", id);
                        }
                      }}
                      disabled={assigningId === sensor.id}
                      className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {(assignable === "plant" || assignable === "both") &&
                        plants.length > 0 && (
                          <optgroup label="Plants">
                            {plants.map((p) => (
                              <option key={p.id} value={`plant:${p.id}`}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      {(assignable === "room" || assignable === "both") &&
                        rooms.length > 0 && (
                          <optgroup label="Rooms">
                            {rooms.map((r) => (
                              <option key={r.id} value={`room:${r.id}`}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">
                      API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 rounded text-xs text-emerald-400 font-mono flex-1 overflow-x-auto border border-zinc-200 dark:border-zinc-800 truncate">
                        {sensor.apiKey || "••••••••••••••••••••••••••••••"}
                      </code>
                      <button
                        onClick={() => handleRegenerateKey(sensor.id)}
                        title="Regenerate Key"
                        className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-700 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500">
                      {sensor.lastPingAt
                        ? `Last ping: ${new Date(sensor.lastPingAt).toLocaleString()}`
                        : "No data received yet"}
                    </span>
                    <button
                      onClick={() => handleDeleteSensor(sensor.id)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Sensor Modal */}
<AddSensorModal
  open={showAddSensor}
  onClose={() => setShowAddSensor(false)}
  onSensorCreated={(sensor) => {
    setShowAddSensor(false);
    loadData(); // re-fetch the list from the server
    if (sensor.apiKey) {
      setShowApiKey(sensor.apiKey);
      setTimeout(() => setShowApiKey(null), 10000);
    }
  }}
/>
    </SectionPanel>
  );
}