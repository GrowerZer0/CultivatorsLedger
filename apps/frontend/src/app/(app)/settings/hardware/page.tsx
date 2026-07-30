"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { getSensors, createSensor, toggleSensor, deleteSensor, regenerateApiKey } from "@/app/actions/sensorconfig";
export default function HardwareSettingsPage() {
  const [sensors, setSensors] = useState<any[]>([]);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [newSensorName, setNewSensorName] = useState('');
  const [newSensorType, setNewSensorType] = useState('custom-http');
  const [loadingSensors, setLoadingSensors] = useState(false);
  const loadSensors = useCallback(async () => {
    setLoadingSensors(true);
    try {
      const data = await getSensors();
      setSensors(data || []);
    } catch (err) {
      console.error("Failed to load sensors:", err);
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
      await createSensor({ name: newSensorName, type: newSensorType });
      setShowAddSensor(false);
      setNewSensorName('');
      loadSensors();
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
      await regenerateApiKey(id);
      loadSensors();
    } catch (error) {
      console.error('Failed to regenerate key:', error);
    }
  }
  return (
    <SectionPanel title="Hardware & Sensor Controller API Keys">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-zinc-400">Manage active HTTP/MQTT telemetry ingestion endpoints.</p>
          <button onClick={() => setShowAddSensor(true)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Sensor Integration
          </button>
        </div>
        {loadingSensors ? (
          <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Syncing telemetry key registry...</div>
        ) : sensors.length === 0 ? (
          <div className="text-xs text-zinc-500 py-8 text-center border border-dashed border-zinc-800 rounded-xl">
            No sensors connected. Add an HTTP endpoint to start ingesting dry-back or environmental data.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensors.map((sensor) => (
              <div key={sensor.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{sensor.name}</h4>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{sensor.type}</span>
                  </div>
                  <button onClick={() => handleToggleSensor(sensor.id, !sensor.isActive)} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sensor.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500"}`}>
                    {sensor.isActive ? "Active" : "Disabled"}
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">API Ingestion Key</label>
                  <div className="flex items-center gap-2">
                    <code className="bg-zinc-950 px-2.5 py-1.5 rounded text-xs text-emerald-400 font-mono flex-1 overflow-x-auto border border-zinc-800">{sensor.apiKey || "••••••••••••••••"}</code>
                    <button onClick={() => handleRegenerateKey(sensor.id)} title="Regenerate Key" className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded hover:bg-zinc-700 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t border-zinc-800/60">
                  <button onClick={() => handleDeleteSensor(sensor.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"><Trash2 className="w-3.5 h-3.5" /> Delete Sensor</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
