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
  getSensors,
  createSensor,
  toggleSensor,
  deleteSensor,
  regenerateApiKey,
} from "@/app/actions";

type UserProfile = any;

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("hardware");
  const [loading, setLoading] = useState(true);
  const [savingHardware, setSavingHardware] = useState(false);
  const [customSchedules, setCustomSchedules] = useState<any[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [activeFeedLine, setActiveFeedLine] = useState("fox-farm-soil-veg");
  const [sensors, setSensors] = useState<any[]>([]);
const [showAddSensor, setShowAddSensor] = useState(false);
const [newSensorName, setNewSensorName] = useState('');
const [newSensorType, setNewSensorType] = useState('vivosun');
const [loadingSensors, setLoadingSensors] = useState(false);

  // --- HARDWARE TELEMETRY INTEGRATION STATE ---
  const [hasClimateHub, setHasClimateHub] = useState(false);

  const loadSensors = useCallback(async () => {
  setLoadingSensors(true);
  try {
    const data = await getSensors();
    setSensors(data || []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoadingSensors(false);
  }
}, []);

useEffect(() => {
  loadSensors();
}, [loadSensors]);

  const loadProfileAndBlueprints = useCallback(async () => {
    setLoading(true);
    try {
      const dbBlueprints = await getCustomBlueprints();
      setCustomSchedules(dbBlueprints || []);
      
      const profile = await getUserProfile() as UserProfile;
      if (profile) {
        if (profile.activeFeedLine) setActiveFeedLine(profile.activeFeedLine);
        }
    } catch (err) {
      console.error("Failed to sync profile configuration maps:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileAndBlueprints();
  }, [loadProfileAndBlueprints]);

  async function handleSetActiveLine(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    setActiveFeedLine(id);
    await updateUserProfile({ activeFeedLine: id });
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
      <div className="space-y-6 relative">
        {/* PAGE HEADER */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Control Room Settings</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Configure system architectures and master facility recipes.</p>
        </div>

        {/* TABS */}
        <div className="border-b border-slate-200 dark:border-zinc-800">
          <nav className="-mb-px flex space-x-8">
            {["hardware", "nutrients"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors capitalize cursor-pointer ${
                    isActive 
                      ? "border-canopy text-canopy dark:text-emerald-400 font-bold" 
                      : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {tab === "nutrients" ? "Nutrient Feed Library" : "Hardware Connections"}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ======================================================= */}
        {/* HARDWARE CONNECTIONS VIEW PANEL                         */}
        {/* ======================================================= */}
        {activeTab === "hardware" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <SectionPanel 
              title="Sensor Management" 
              subtitle="Register and manage devices that send telemetry data to your ingest endpoint."
            >
              {loadingSensors ? (
                <p className="text-sm text-zinc-500">Loading sensors...</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-zinc-400">Registered Sensors</h3>
                    <button
                      onClick={() => setShowAddSensor(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold"
                    >
                      + Add Sensor
                    </button>
                  </div>

                  {sensors.length === 0 ? (
                    <p className="text-sm text-zinc-500">No sensors registered.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sensors.map((sensor) => (
                        <li key={sensor.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                          <div>
                            <p className="font-bold text-white">{sensor.name}</p>
                            <p className="text-xs text-zinc-400">{sensor.type} • {sensor.isActive ? '🟢 Active' : '🔴 Inactive'}</p>
                            {sensor.lastPingAt && (
                              <p className="text-xs text-zinc-500">Last ping: {new Date(sensor.lastPingAt).toLocaleString()}</p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={async () => {
                                await toggleSensor(sensor.id, !sensor.isActive);
                                loadSensors();
                              }}
                              className="text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                            >
                              {sensor.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={async () => {
                                const result = await regenerateApiKey(sensor.id);
                                alert(`New API Key: ${result.apiKey}`);
                                loadSensors();
                              }}
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                            >
                              Regenerate Key
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete sensor "${sensor.name}"?`)) {
                                  await deleteSensor(sensor.id);
                                  loadSensors();
                                }
                              }}
                              className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </SectionPanel>
          </div>
        )}

        {/* ======================================================= */}
        {/* NUTRIENT FEED LIBRARY VIEW PANEL                        */}
        {/* ======================================================= */}
        {activeTab === "nutrients" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <SectionPanel title="Master Recipe Formulations" subtitle="Modify targets and concentrations across your available brand schedules.">
              {loading ? (
                <div className="text-sm font-medium text-slate-400 py-12 text-center animate-pulse">
                  Querying master cloud ledger schemas...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleInitCreate}
                    className="flex flex-col items-center justify-center h-full min-h-[220px] rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-800 bg-stone-50/40 dark:bg-zinc-950/20 hover:bg-stone-50 dark:hover:bg-zinc-900/40 hover:border-canopy dark:hover:border-emerald-500 transition-all cursor-pointer group text-center p-6"
                  >
                    <div className="rounded-full bg-white dark:bg-zinc-900 p-3 shadow-sm border border-slate-200 dark:border-zinc-800 group-hover:scale-110 transition-transform">
                      <Plus className="size-5 text-slate-500 dark:text-zinc-400 group-hover:text-canopy dark:group-hover:text-emerald-400" />
                    </div>
                    <span className="mt-3 text-sm font-bold text-slate-700 dark:text-zinc-200">Create Custom Line</span>
                    <span className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-[180px]">Deploy fresh localized brand formulations</span>
                  </button>

                  {allSchedules.map((schedule) => {
                    const isCurrentlyActive = activeFeedLine === schedule.id;
                    return (
                      <div 
                        key={schedule.id} 
                        className={`p-5 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between space-y-4 transition-all hover:shadow-md relative ${
                          isCurrentlyActive 
                            ? "border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20" 
                            : "border-slate-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            schedule.isCustom 
                              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/40" 
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500"
                          }`}>
                            {schedule.isCustom ? "Custom" : "System Preset"}
                          </span>
                          
                          <button
                            type="button"
                            onClick={(e) => handleSetActiveLine(schedule.id, e)}
                            className={`text-xs font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                              isCurrentlyActive 
                                ? "bg-emerald-500 text-white shadow-sm" 
                                : "bg-stone-50 hover:bg-stone-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800"
                            }`}
                          >
                            {isCurrentlyActive ? "✓ Active" : "Set Active"}
                          </button>
                        </div>

                        <div>
                          <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                            <FlaskConical className="size-4 text-canopy dark:text-emerald-400 shrink-0" />
                            {schedule.brand || "Unnamed Recipe"}
                          </h3>
                          <div className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
                            <div className="flex justify-between">
                              <span className="text-slate-500 dark:text-zinc-400">Target Baseline:</span>
                              <span className="font-semibold text-slate-900 dark:text-zinc-100">{schedule.targetEc} EC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 dark:text-zinc-400">Concentrates:</span>
                              <span className="font-semibold text-slate-900 dark:text-zinc-100">{schedule.doses?.length || 0} Parts</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setEditingSchedule(JSON.parse(JSON.stringify(schedule)))}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-stone-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                          >
                            <Sliders className="size-3" /> Edit PPMs
                          </button>

                          {schedule.isCustom ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(schedule.id);
                              }}
                              className="p-1.5 rounded-md border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="p-1.5 rounded-md text-slate-300 dark:text-zinc-700 cursor-not-allowed opacity-50"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionPanel>
          </div>
        )}

        {/* 🛠️ SLIDE-OVER RECIPE EDITOR */}
        {editingSchedule && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-zinc-800">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                    {editingSchedule.brand ? "Edit Recipe Parts" : "New Formulation Parameters"}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {editingSchedule.brand ? `${editingSchedule.brand} (${editingSchedule.stage || "All Cycles"})` : "Configure brand matrix properties"}
                  </p>
                </div>
                <button onClick={() => setEditingSchedule(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer">
                  <X className="size-5 text-slate-500 dark:text-zinc-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold uppercase text-slate-400 dark:text-zinc-400">Brand / Line Name</label>
                    <input 
                      type="text"
                      placeholder="e.g., Athena Pro"
                      value={editingSchedule.brand} 
                      onChange={(e) => setEditingSchedule({...editingSchedule, brand: e.target.value})}
                      className="w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2 text-sm outline-none focus:border-canopy text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold uppercase text-slate-400 dark:text-zinc-400">Target EC Baseline</label>
                    <input 
                      type="number"
                      step="0.1"
                      placeholder="2.0"
                      value={editingSchedule.targetEc} 
                      onChange={(e) => setEditingSchedule({...editingSchedule, targetEc: Number(e.target.value)})}
                      className="w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2 text-sm outline-none focus:border-canopy text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-slate-400 dark:text-zinc-400">Concentrate Part Ratios (ml / Gal)</label>
                    <button
                      type="button"
                      onClick={() => setEditingSchedule({
                        ...editingSchedule,
                        doses: [...editingSchedule.doses, { product: "", mlPerGallon: 0 }]
                      })}
                      className="text-xs font-bold text-canopy dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="size-3" /> Add Part
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editingSchedule.doses?.map((dose: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <input 
                          type="text"
                          placeholder="e.g., Core / Bloom"
                          value={dose.product}
                          onChange={(e) => {
                            const newDoses = [...editingSchedule.doses];
                            newDoses[index].product = e.target.value;
                            setEditingSchedule({...editingSchedule, doses: newDoses});
                          }}
                          className="flex-1 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2 text-sm outline-none text-slate-900 dark:text-zinc-100"
                        />
                        <input 
                          type="number"
                          step="0.1"
                          placeholder="4.0"
                          value={dose.mlPerGallon}
                          onChange={(e) => {
                            const newDoses = [...editingSchedule.doses];
                            newDoses[index].mlPerGallon = Number(e.target.value);
                            setEditingSchedule({...editingSchedule, doses: newDoses});
                          }}
                          className="w-20 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2 text-sm outline-none text-slate-900 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newDoses = editingSchedule.doses.filter((_: any, i: number) => i !== index);
                            setEditingSchedule({...editingSchedule, doses: newDoses});
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-950/20">
                <button 
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-zinc-800 rounded-md text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-bold bg-canopy dark:bg-emerald-600 text-white rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="size-4" /> Save Recipe
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Add Sensor Modal */}
{showAddSensor && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
      <h2 className="text-lg font-bold text-white mb-4">Add New Sensor</h2>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Sensor Name (e.g., Tent 1 Sensor)"
          value={newSensorName}
          onChange={(e) => setNewSensorName(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
        />
        <select
          value={newSensorType}
          onChange={(e) => setNewSensorType(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
        >
          <option value="custom-http">Custom HTTP</option>
          <option value="mqtt">MQTT</option>
        </select>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowAddSensor(false)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!newSensorName) return;
              const result = await createSensor({ name: newSensorName, type: newSensorType });
              alert(`Sensor created! API Key: ${result.apiKey}`);
              setShowAddSensor(false);
              setNewSensorName('');
              setNewSensorType('vivosun');
              loadSensors();
            }}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </AppShell>
  );
}