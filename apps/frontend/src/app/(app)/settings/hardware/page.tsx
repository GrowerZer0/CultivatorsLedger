"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, RefreshCw, ChevronLeft, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { getSensors, createSensor, toggleSensor, deleteSensor, regenerateApiKey } from "@/server/actions/sensorconfig";

type Plant = {
  id: string;
  name: string;
};

export default function HardwareSettingsPage() {
  const [sensors, setSensors] = useState<any[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [newSensorName, setNewSensorName] = useState('');
  const [newSensorType, setNewSensorType] = useState('esp32-loadcell');
  const [newSensorPlantId, setNewSensorPlantId] = useState('');
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  const loadSensors = useCallback(async () => {
    setLoadingSensors(true);
    try {
      const [sensorsData, plantsData] = await Promise.all([
        getSensors(),
        fetch('/api/plants').then(r => r.json()),
      ]);
      setSensors(sensorsData || []);
      setPlants(plantsData || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoadingSensors(false);
    }
  }, []);

  useEffect(() => {
    loadSensors();
  }, [loadSensors]);

  async function handleAddSensor() {
    if (!newSensorName) {
      alert("Sensor name is required.");
      return;
    }
    try {
      const result = await createSensor({ 
        name: newSensorName, 
        type: newSensorType,
        plantId: newSensorPlantId || undefined,
      });
      setShowAddSensor(false);
      setNewSensorName('');
      setNewSensorPlantId('');
      loadSensors();
      // Show the API key
      if (result.apiKey) {
        setShowApiKey(result.apiKey);
        setTimeout(() => setShowApiKey(null), 10000);
      }
    } catch (error) {
      console.error('Failed to add sensor:', error);
      alert('Failed to add sensor.');
    }
  }

  async function handleToggleSensor(id: string, isActive: boolean) {
    try {
      await toggleSensor(id, isActive);
      loadSensors();
    } catch (error) {
      console.error('Failed to toggle sensor:', error);
    }
  }

  async function handleDeleteSensor(id: string) {
    if (!confirm("Are you sure you want to remove this sensor integration?")) return;
    try {
      await deleteSensor(id);
      loadSensors();
    } catch (error) {
      console.error('Failed to delete sensor:', error);
    }
  }

  async function handleRegenerateKey(id: string) {
    if (!confirm("Regenerating the API key will break active telemetry streams until updated on your hardware. Continue?")) return;
    try {
      const result = await regenerateApiKey(id);
      loadSensors();
      if (result.apiKey) {
        setShowApiKey(result.apiKey);
        setTimeout(() => setShowApiKey(null), 10000);
      }
    } catch (error) {
      console.error('Failed to regenerate key:', error);
    }
  }

  const getStatusDisplay = (sensor: any) => {
    if (!sensor.lastPingAt) {
      return { label: 'Never pinged', color: 'text-zinc-500', icon: null };
    }
    const lastPing = new Date(sensor.lastPingAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastPing.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) {
      return { label: 'Online', color: 'text-emerald-400', icon: <Wifi className="size-3" /> };
    } else if (diffMinutes < 60) {
      return { label: `Last seen ${Math.round(diffMinutes)}m ago`, color: 'text-yellow-400', icon: <WifiOff className="size-3" /> };
    } else {
      return { label: `Last seen ${Math.round(diffMinutes / 60)}h ago`, color: 'text-red-400', icon: <WifiOff className="size-3" /> };
    }
  };

  return (
    <SectionPanel title="Hardware & Sensor Controller">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-zinc-400">Manage your ESP32 load cells and environmental sensors.</p>
            {showApiKey && (
              <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-400 font-mono">
                  🔑 New API Key: <span className="font-bold">{showApiKey}</span>
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">Copy this key now. It won&apos;t be shown again.</p>
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
          <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Loading devices...</div>
        ) : sensors.length === 0 ? (
          <div className="text-xs text-zinc-500 py-8 text-center border border-dashed border-zinc-800 rounded-xl">
            <p className="font-semibold text-zinc-400">No hardware devices configured</p>
            <p className="mt-1">Add your ESP32 load cell to start receiving weight data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensors.map((sensor) => {
              const status = getStatusDisplay(sensor);
              return (
                <div key={sensor.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {sensor.name}
                        {sensor.type === 'esp32-loadcell' && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Load Cell</span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${status.color} flex items-center gap-1`}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleToggleSensor(sensor.id, !sensor.isActive)} 
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sensor.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500"}`}
                      >
                        {sensor.isActive ? "Active" : "Disabled"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">API Key</label>
                    <div className="flex items-center gap-2">
                      <code className="bg-zinc-950 px-2.5 py-1.5 rounded text-xs text-emerald-400 font-mono flex-1 overflow-x-auto border border-zinc-800 truncate">
                        {sensor.apiKey || "••••••••••••••••••••••••••••••"}
                      </code>
                      <button 
                        onClick={() => handleRegenerateKey(sensor.id)} 
                        title="Regenerate Key" 
                        className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded hover:bg-zinc-700 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500">
                      {sensor.lastPingAt ? `Last ping: ${new Date(sensor.lastPingAt).toLocaleString()}` : 'No data received yet'}
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
      {showAddSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add Device</h3>
              <button onClick={() => setShowAddSensor(false)} className="text-zinc-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400">Device Name</label>
                <input
                  type="text"
                  value={newSensorName}
                  onChange={(e) => setNewSensorName(e.target.value)}
                  placeholder="e.g. Early Frost Load Cell"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400">Device Type</label>
                <select
                  value={newSensorType}
                  onChange={(e) => setNewSensorType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="esp32-loadcell">ESP32 Load Cell</option>
                  <option value="esp32-environmental">ESP32 Environmental</option>
                  <option value="custom-http">Custom HTTP</option>
                  <option value="vivosun">VIVOSUN</option>
                  <option value="mqtt">MQTT</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Associate with Plant (optional)</label>
                <select
                  value={newSensorPlantId}
                  onChange={(e) => setNewSensorPlantId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">None</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>{plant.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddSensor}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                >
                  Add Device
                </button>
                <button
                  onClick={() => setShowAddSensor(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectionPanel>
  );
}
