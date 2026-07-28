// src/app/settings/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {  
  FlaskConical, 
  Sliders,
  Plus,
  X,
  Save,
  Trash2,
  Cpu,
  Bell,
  Building, 
  TreePine, 
  Edit,  
  Download,
  LogOut,
  RefreshCw,
  Key
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { commercialFeedSchedules } from "@/lib/cultivation";
import { 
  getCustomBlueprints, 
  saveOrUpdateBlueprint, 
  deleteCustomBlueprint, 
  getUserProfile, 
  updateUserProfile,
} from "@/app/actions";
import {
  getBatches,
  createBatch,
  updateBatch, 
  deleteBatch, 
  exportAllBatches,
} from "@/app/actions/batch-mgmt";
import {
  getPlantsForBatch, 
  createPlant, 
  updatePlant, 
  deletePlant, 
} from "@/app/actions/plant-mgmt";
import {
  getRooms,
} from "@/app/actions/facility-mgmt";
import {
  getSensors,
  createSensor,
  toggleSensor,
  deleteSensor,
  regenerateApiKey,
} from "@/app/actions/sensorconfig";
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { getSystemSettings, updateTempUnitPreference } from "@/app/actions/system-settings";

type UserProfile = any;
type Room = { id: string; name: string };
type Batch = { 
  id: string; 
  name: string; 
  cultivar: string; 
  roomId?: string | null; 
  isActive: boolean;
  dryBackLogs?: any[];
  startDate?: Date | string;
};
type Plant = { 
  id: string; 
  name: string; 
  strain?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("hardware");
  const [loading, setLoading] = useState(true);
  const [customSchedules, setCustomSchedules] = useState<any[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [activeFeedLine, setActiveFeedLine] = useState("fox-farm-soil-veg");
  
  // Hardware / Sensor states
  const [sensors, setSensors] = useState<any[]>([]);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [newSensorName, setNewSensorName] = useState('');
  const [newSensorType, setNewSensorType] = useState('custom-http');
  const [loadingSensors, setLoadingSensors] = useState(false);

  // Batch & Facility states
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchCultivar, setNewBatchCultivar] = useState('');
  const [newBatchRoom, setNewBatchRoom] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  // Preferences state
  const [preferredTempUnit, setPreferredTempUnit] = useState<"C" | "F">("C");

  // Plant management states
  const [plants, setPlants] = useState<Plant[]>([]);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantWet, setNewPlantWet] = useState<number | ''>('');
  const [newPlantDry, setNewPlantDry] = useState<number | ''>('');
  const [newPlantStrain, setNewPlantStrain] = useState('');
  const [newPlantRoomId, setNewPlantRoomId] = useState<string | null>(null);
  const [newPlantBatchId, setNewPlantBatchId] = useState<string | null>(null);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  useEffect(() => {
    loadSensors();
  }, [loadSensors]);

  const loadProfileAndBlueprints = useCallback(async () => {
    setLoading(true);
    try {
      const dbBlueprints = await getCustomBlueprints();
      setCustomSchedules(dbBlueprints || []);
      
      const profile = await getUserProfile() as UserProfile;
      if (profile?.activeFeedLine) {
        setActiveFeedLine(profile.activeFeedLine);
      }

      const settings = await getSystemSettings();
      setPreferredTempUnit(settings.preferredTempUnit === "F" ? "F" : "C");
    } catch (err) {
      console.error("Failed to sync profile configuration maps:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileAndBlueprints();
  }, [loadProfileAndBlueprints]);

  const loadBatchesAndRooms = useCallback(async () => {
    try {
      const fetchedBatches = await getBatches();
      const formattedBatches = fetchedBatches.map(batch => ({
        ...batch,
        startDate: new Date(batch.startDate).toISOString(),
      }));
      setBatches(formattedBatches || []);
      if (formattedBatches.length > 0 && !selectedBatchId) {
        setSelectedBatchId(formattedBatches[0].id);
      }

      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms || []);
      if (fetchedRooms.length > 0 && !newBatchRoom) {
        setNewBatchRoom(fetchedRooms[0].id);
        setNewPlantRoomId(fetchedRooms[0].id);
      }
    } catch (err) {
      console.error("Failed to load batches or rooms:", err);
    }
  }, [selectedBatchId, newBatchRoom]);

  const loadPlantsForSelectedBatch = useCallback(async () => {
    if (selectedBatchId) {
      try {
        const fetchedPlants = await getPlantsForBatch(selectedBatchId);
        const formattedPlants = fetchedPlants.map(plant => ({
          ...plant,
          wetWeight: plant.wetWeight !== null ? Number(plant.wetWeight) : null,
          dryTarget: plant.dryTarget !== null ? Number(plant.dryTarget) : null,
        }));
        setPlants(formattedPlants || []);
      } catch (err) {
        console.error("Failed to load plants for batch:", err);
      }
    } else {
      setPlants([]);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    loadBatchesAndRooms();
  }, [loadBatchesAndRooms]);

  useEffect(() => {
    loadPlantsForSelectedBatch();
  }, [loadPlantsForSelectedBatch]);

  async function handleSetActiveLine(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    setActiveFeedLine(id);
    await updateUserProfile({ activeFeedLine: id });
  }

  async function handleTempUnitToggle(unit: "C" | "F") {
    setPreferredTempUnit(unit);
    await updateTempUnitPreference(unit);
  }

  const allSchedules = [
    ...commercialFeedSchedules.map(s => {
      const override = customSchedules.find(cs => cs.id === s.id);
      return override ? {
        id: override.id,
        brand: override.brand,
        stage: override.stage,
        targetEc: override.target_ec,
        doses: override.doses_json,
        isCustom: override.is_custom
      } : { ...s, isCustom: false };
    }),
    ...customSchedules
      .filter(cs => !commercialFeedSchedules.find(s => s.id === cs.id))
      .map(cs => ({
        id: cs.id,
        brand: cs.brand,
        stage: cs.stage,
        targetEc: cs.target_ec,
        doses: cs.doses_json,
        isCustom: cs.is_custom
      }))
  ];

  const handleExportAll = async () => {
    const data = await exportAllBatches();
    if (!data || data.length === 0) {
      alert('No batch data to export.');
      return;
    }
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `cultivators_ledger_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  function handleInitCreate() {
    setEditingSchedule({
      id: `custom-${crypto.randomUUID()}`,
      brand: "",
      stage: "",
      targetEc: 1.8,
      doses: [
        { product: "Base Part A", mlPerGallon: 4.0 },
        { product: "Base Part B", mlPerGallon: 4.0 }
      ],
      isCustom: true
    });
  }

  async function handleCreateBatch() {
    if (!newBatchName || !newBatchCultivar) {
      alert("Batch name and cultivar are required.");
      return;
    }
    try {
      await createBatch({
        name: newBatchName,
        cultivar: newBatchCultivar,
        roomId: newBatchRoom || undefined,
        startDate: new Date(),
        isActive: true
      });
      setShowNewBatchModal(false);
      setNewBatchName('');
      setNewBatchCultivar('');
      loadBatchesAndRooms();
    } catch (error) {
      console.error('Failed to create batch:', error);
      alert('Failed to create batch.');
    }
  }

  async function handleUpdateBatchStatus(batchId: string, isActive: boolean) {
    try {
      await updateBatch(batchId, { isActive });
      loadBatchesAndRooms();
    } catch (error) {
      console.error('Failed to update batch status:', error);
      alert('Failed to update batch status.');
    }
  }

  async function handleDeleteBatch(batchId: string) {
    if (!confirm("Are you sure you want to delete this batch and all associated plants and logs? This action cannot be undone.")) return;
    try {
      await deleteBatch(batchId);
      loadBatchesAndRooms();
    } catch (error) {
      console.error('Failed to delete batch:', error);
      alert('Failed to delete batch.');
    }
  }

  async function handleAddSensor() {
    if (!newSensorName) {
      alert("Sensor name is required.");
      return;
    }
    try {
      await createSensor({
        name: newSensorName,
        type: newSensorType,
      });
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

  async function handleAddPlant() {
    if (!newPlantName || !newPlantBatchId) {
      alert("Plant name and batch are required.");
      return;
    }
    try {
      await createPlant({
        name: newPlantName,
        batchId: newPlantBatchId,
        roomId: newPlantRoomId || undefined,
        strain: newPlantStrain || undefined,
        wetWeight: newPlantWet !== '' ? Number(newPlantWet) : undefined,
        dryTarget: newPlantDry !== '' ? Number(newPlantDry) : undefined,
      });
      setShowPlantModal(false);
      setNewPlantName('');
      setNewPlantWet('');
      setNewPlantDry('');
      setNewPlantStrain('');
      setNewPlantRoomId(rooms.length > 0 ? rooms[0].id : null);
      loadPlantsForSelectedBatch();
    } catch (error) {
      console.error('Failed to add plant:', error);
      alert('Failed to add plant.');
    }
  }

  async function handleUpdatePlant() {
    if (!editingPlant || !newPlantName) {
      alert("Plant name is required.");
      return;
    }
    try {
      await updatePlant({
        id: editingPlant.id,
        name: newPlantName,
        strain: newPlantStrain || undefined,
        roomId: newPlantRoomId || undefined,
        wetWeight: newPlantWet !== '' ? Number(newPlantWet) : null,
        dryTarget: newPlantDry !== '' ? Number(newPlantDry) : null,
      });
      setShowPlantModal(false);
      setEditingPlant(null);
      setNewPlantName('');
      setNewPlantWet('');
      setNewPlantDry('');
      setNewPlantStrain('');
      setNewPlantRoomId(rooms.length > 0 ? rooms[0].id : null);
      loadPlantsForSelectedBatch();
    } catch (error) {
      console.error('Failed to update plant:', error);
      alert('Failed to update plant.');
    }
  }

  async function handleDeletePlant(plantId: string) {
    if (!confirm("Are you sure you want to delete this plant and all its associated logs? This action cannot be undone.")) return;
    try {
      await deletePlant(plantId);
      loadPlantsForSelectedBatch();
    } catch (error) {
      console.error('Failed to delete plant:', error);
      alert('Failed to delete plant.');
    }
  }

  async function handleSave() {
    if (!editingSchedule) return;
    if (!editingSchedule.brand.trim()) {
      alert("Please provide a manufacturer or brand name before saving.");
      return;
    }

    const result = await saveOrUpdateBlueprint({
      id: editingSchedule.id,
      brand: editingSchedule.brand,
      stage: editingSchedule.stage || "All Cycles",
      target_ec: editingSchedule.targetEc,
      doses_json: editingSchedule.doses
    });

    if (result.success) {
      setEditingSchedule(null);
      loadProfileAndBlueprints();
    } else {
      alert("Failed to sync recipe to cloud.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you absolutely sure you want to delete this custom nutrient profile? This change will immediately affect dashboard execution targets.")) return;
    
    try {
      const result = await deleteCustomBlueprint(id);
      if (result && result.success) {
        setEditingSchedule(null);
        loadProfileAndBlueprints();
      } else {
        alert("Deletion failure: Could not clear record.");
      }
    } catch (err) {
      console.error("Failed to delete blueprint:", err);
      alert("Deletion failure: Could not clear record.");
    }
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-emerald-400" /> System Settings & Controls
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Configure telemetry pipelines, crop batches, custom fertigation schedules, and account settings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAll}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition flex items-center gap-2 border border-zinc-700"
            >
              <Download className="w-4 h-4" /> Export All Data
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Settings Sub-Navigation */}
        <div className="flex border-b border-zinc-800 space-x-6 text-sm font-medium">
          {[
            { id: "hardware", label: "Hardware & Telemetry", icon: Cpu },
            { id: "batches", label: "Batches & Plants", icon: TreePine },
            { id: "fertigation", label: "Fertigation Blueprints", icon: FlaskConical },
            { id: "preferences", label: "System Preferences", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 border-b-2 transition ${
                  isActive
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Hardware & Telemetry Tab */}
        {activeTab === "hardware" && (
          <SectionPanel title="Hardware & Sensor Controller API Keys">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-400">
                  Manage active HTTP/MQTT telemetry ingestion endpoints.
                </p>
                <button
                  onClick={() => setShowAddSensor(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Sensor Integration
                </button>
              </div>

              {loadingSensors ? (
                <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">
                  Syncing telemetry key registry...
                </div>
              ) : sensors.length === 0 ? (
                <div className="text-xs text-zinc-500 py-8 text-center border border-dashed border-zinc-800 rounded-xl">
                  No sensors connected. Add an HTTP endpoint to start ingesting dry-back or environmental data.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sensors.map((sensor) => (
                    <div
                      key={sensor.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">{sensor.name}</h4>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {sensor.type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggleSensor(sensor.id, !sensor.isActive)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            sensor.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {sensor.isActive ? "Active" : "Disabled"}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold">API Ingestion Key</label>
                        <div className="flex items-center gap-2">
                          <code className="bg-zinc-950 px-2.5 py-1.5 rounded text-xs text-emerald-400 font-mono flex-1 overflow-x-auto border border-zinc-800">
                            {sensor.apiKey || "••••••••••••••••"}
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

                      <div className="flex justify-end pt-2 border-t border-zinc-800/60">
                        <button
                          onClick={() => handleDeleteSensor(sensor.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Sensor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionPanel>
        )}

        {/* Batches & Plants Tab */}
        {activeTab === "batches" && (
          <div className="space-y-6">
            <SectionPanel title="Active Crop Batches">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-zinc-400">
                    Organize your canopy into tracked batches with associated cultivars and grow rooms.
                  </p>
                  <button
                    onClick={() => setShowNewBatchModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Create New Batch
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      onClick={() => setSelectedBatchId(batch.id)}
                      className={`cursor-pointer p-4 rounded-xl border transition ${
                        selectedBatchId === batch.id
                          ? "bg-zinc-900 border-emerald-500/50 shadow-lg shadow-emerald-500/5"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-white">{batch.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          batch.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                        }`}>
                          {batch.isActive ? "Active" : "Archived"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">Cultivar: <span className="text-zinc-200 font-medium">{batch.cultivar}</span></p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Started: {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : 'N/A'}
                      </p>

                      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-zinc-800/60">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateBatchStatus(batch.id, !batch.isActive);
                          }}
                          className="text-[11px] text-zinc-400 hover:text-white transition"
                        >
                          {batch.isActive ? "Archive" : "Activate"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBatch(batch.id);
                          }}
                          className="text-[11px] text-red-400 hover:text-red-300 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionPanel>

            <SectionPanel title={`Plants in Selected Batch`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-zinc-400">
                    Manage individual plant telemetry metrics and target thresholds.
                  </p>
                  <button
                    onClick={() => {
                      setNewPlantBatchId(selectedBatchId);
                      setShowPlantModal(true);
                    }}
                    disabled={!selectedBatchId}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Plant to Batch
                  </button>
                </div>

                {plants.length === 0 ? (
                  <div className="text-xs text-zinc-500 py-8 text-center border border-dashed border-zinc-800 rounded-xl">
                    No plants registered for this batch.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                          <th className="py-2.5 px-3">Plant ID / Tag</th>
                          <th className="py-2.5 px-3">Strain</th>
                          <th className="py-2.5 px-3">Wet Weight</th>
                          <th className="py-2.5 px-3">Dry Target</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {plants.map((plant) => (
                          <tr key={plant.id} className="hover:bg-zinc-900/40">
                            <td className="py-3 px-3 font-medium text-white">{plant.name}</td>
                            <td className="py-3 px-3 text-zinc-400">{plant.strain || "--"}</td>
                            <td className="py-3 px-3 text-zinc-300">{plant.wetWeight ? `${plant.wetWeight} g` : "--"}</td>
                            <td className="py-3 px-3 text-zinc-300">{plant.dryTarget ? `${plant.dryTarget} g` : "--"}</td>
                            <td className="py-3 px-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingPlant(plant);
                                  setNewPlantName(plant.name);
                                  setNewPlantStrain(plant.strain || '');
                                  setNewPlantWet(plant.wetWeight ?? '');
                                  setNewPlantDry(plant.dryTarget ?? '');
                                  setShowPlantModal(true);
                                }}
                                className="text-zinc-400 hover:text-white transition"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePlant(plant.id)}
                                className="text-red-400 hover:text-red-300 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </SectionPanel>
          </div>
        )}

        {/* Fertigation Blueprints Tab */}
        {activeTab === "fertigation" && (
          <SectionPanel title="Fertigation Schedules & Recipe Blueprints">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-400">
                  Select your primary feed profile or customize EC targets and dosing ratios.
                </p>
                <button
                  onClick={handleInitCreate}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create Custom Blueprint
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allSchedules.map((schedule) => {
                  const isActive = activeFeedLine === schedule.id;
                  return (
                    <div
                      key={schedule.id}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                        isActive
                          ? "bg-zinc-900 border-emerald-500 shadow-md shadow-emerald-500/10"
                          : "bg-zinc-900/60 border-zinc-800"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-bold text-white">{schedule.brand}</h4>
                          {schedule.isCustom && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">Stage: {schedule.stage}</p>
                        <p className="text-xs text-emerald-400 font-mono mt-0.5">Target EC: {schedule.targetEc}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                        <button
                          onClick={(e) => handleSetActiveLine(schedule.id, e)}
                          className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${
                            isActive
                              ? "bg-emerald-500 text-black"
                              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          }`}
                        >
                          {isActive ? "Active Blueprint" : "Set Active"}
                        </button>

                        {schedule.isCustom && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingSchedule(schedule)}
                              className="p-1 text-zinc-400 hover:text-white transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(schedule.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionPanel>
        )}

        {/* System Preferences Tab */}
        {activeTab === "preferences" && (
          <SectionPanel title="System Preferences & Displays">
            <div className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Temperature Scale</h4>
                  <p className="text-xs text-zinc-400">Choose preferred telemetry temperature display unit.</p>
                </div>
                <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
                  <button
                    onClick={() => handleTempUnitToggle("C")}
                    className={`px-3 py-1 text-xs font-bold rounded ${
                      preferredTempUnit === "C" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    °C
                  </button>
                  <button
                    onClick={() => handleTempUnitToggle("F")}
                    className={`px-3 py-1 text-xs font-bold rounded ${
                      preferredTempUnit === "F" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    °F
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">UI Color Mode</h4>
                  <p className="text-xs text-zinc-400">Toggle dark and light visual mode.</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </SectionPanel>
        )}

        {/* Add Sensor Modal */}
        {showAddSensor && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white">Add Hardware Sensor Integration</h3>
                <button onClick={() => setShowAddSensor(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300">Sensor Endpoint Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tent 1 Scale / Environment Node"
                    value={newSensorName}
                    onChange={(e) => setNewSensorName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300">Protocol / Type</label>
                  <select
                    value={newSensorType}
                    onChange={(e) => setNewSensorType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  >
                    <option value="custom-http">Custom HTTP JSON POST</option>
                    <option value="mqtt">MQTT Telemetry Pipeline</option>
                    <option value="esphome">ESPHome / Home Assistant API</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setShowAddSensor(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSensor}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Register Sensor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Batch Modal */}
        {showNewBatchModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white">Register New Crop Batch</h3>
                <button onClick={() => setShowNewBatchModal(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300">Batch Name / Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. Batch #2026-07-B"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300">Cultivar / Strain</label>
                  <input
                    type="text"
                    placeholder="e.g. Blueberry Muffin"
                    value={newBatchCultivar}
                    onChange={(e) => setNewBatchCultivar(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300">Assigned Room</label>
                  <select
                    value={newBatchRoom || ''}
                    onChange={(e) => setNewBatchRoom(e.target.value || null)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  >
                    <option value="">Unassigned</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setShowNewBatchModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBatch}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Create Batch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Plant Modal */}
        {showPlantModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white">
                  {editingPlant ? "Edit Plant Metadata" : "Register Plant in Batch"}
                </h3>
                <button onClick={() => { setShowPlantModal(false); setEditingPlant(null); }} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300">Plant Tag / ID</label>
                  <input
                    type="text"
                    placeholder="e.g. Plant #01"
                    value={newPlantName}
                    onChange={(e) => setNewPlantName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300">Strain Override</label>
                  <input
                    type="text"
                    placeholder="e.g. Blueberry Muffin Pheno #2"
                    value={newPlantStrain}
                    onChange={(e) => setNewPlantStrain(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300">Wet Weight (g)</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      value={newPlantWet}
                      onChange={(e) => setNewPlantWet(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-300">Dry Target (g)</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      value={newPlantDry}
                      onChange={(e) => setNewPlantDry(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => { setShowPlantModal(false); setEditingPlant(null); }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={editingPlant ? handleUpdatePlant : handleAddPlant}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {editingPlant ? "Update Plant" : "Save Plant"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Recipe Modal */}
        {editingSchedule && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white">Edit Custom Fertigation Recipe</h3>
                <button onClick={() => setEditingSchedule(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300">Brand / Recipe Name</label>
                  <input
                    type="text"
                    value={editingSchedule.brand}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, brand: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300">Growth Stage</label>
                    <input
                      type="text"
                      placeholder="e.g. Early Veg / Mid Bloom"
                      value={editingSchedule.stage}
                      onChange={(e) => setEditingSchedule({ ...editingSchedule, stage: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300">Target EC (mS/cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingSchedule.targetEc}
                      onChange={(e) => setEditingSchedule({ ...editingSchedule, targetEc: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 mb-1 block">Nutrient Inputs (mL / Gal)</label>
                  {editingSchedule.doses?.map((dose: any, index: number) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Part A / CalMag"
                        value={dose.product}
                        onChange={(e) => {
                          const newDoses = [...editingSchedule.doses];
                          newDoses[index].product = e.target.value;
                          setEditingSchedule({ ...editingSchedule, doses: newDoses });
                        }}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="mL"
                        value={dose.mlPerGallon}
                        onChange={(e) => {
                          const newDoses = [...editingSchedule.doses];
                          newDoses[index].mlPerGallon = parseFloat(e.target.value) || 0;
                          setEditingSchedule({ ...editingSchedule, doses: newDoses });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setEditingSchedule(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Blueprint
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}