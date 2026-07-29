"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Save, Trash2, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { commercialFeedSchedules } from "@/lib/cultivation";
import { getCustomBlueprints, saveOrUpdateBlueprint, deleteCustomBlueprint } from "@/app/actions";
import { getUserProfile, updateUserProfile } from "@/app/actions/profile";
import { AppShell } from '@/components/layout/AppShell';

export default function NutrientsSettingsPage() {
  const [customSchedules, setCustomSchedules] = useState<any[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [activeFeedLine, setActiveFeedLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndBlueprints = useCallback(async () => {
    setLoading(true);
    try {
      const dbBlueprints = await getCustomBlueprints();
      setCustomSchedules(dbBlueprints || []);
      const profile = await getUserProfile();
      if (profile?.activeFeedLine) setActiveFeedLine(profile.activeFeedLine);
    } catch (err) {
      console.error("Failed to sync profile configuration maps:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfileAndBlueprints(); }, [loadProfileAndBlueprints]);

  const allSchedules = [
    ...commercialFeedSchedules.map(s => {
      const override = customSchedules.find(cs => cs.id === s.id);
      return override ? { id: override.id, brand: override.brand, stage: override.stage, targetEc: override.target_ec, doses: override.doses_json, isCustom: override.is_custom } : { ...s, isCustom: false };
    }),
    ...customSchedules.filter(cs => !commercialFeedSchedules.find(s => s.id === cs.id)).map(cs => ({ id: cs.id, brand: cs.brand, stage: cs.stage, targetEc: cs.target_ec, doses: cs.doses_json, isCustom: cs.is_custom }))
  ];

  async function handleSetActiveLine(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    setActiveFeedLine(id);
    await updateUserProfile({ activeFeedLine: id });
  }

  function handleInitCreate() {
    setEditingSchedule({ id: `custom-${crypto.randomUUID()}`, brand: "", stage: "", targetEc: 1.8, doses: [{ product: "Base Part A", mlPerGallon: 4.0 }, { product: "Base Part B", mlPerGallon: 4.0 }], isCustom: true });
  }

  async function handleSave() {
    if (!editingSchedule) return;
    if (!editingSchedule.brand.trim()) { alert("Please provide a manufacturer or brand name before saving."); return; }
    const result = await saveOrUpdateBlueprint({ id: editingSchedule.id, brand: editingSchedule.brand, stage: editingSchedule.stage || "All Cycles", target_ec: editingSchedule.targetEc, doses_json: editingSchedule.doses });
    if (result.success) { setEditingSchedule(null); loadProfileAndBlueprints(); } else { alert("Failed to sync recipe to cloud."); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you absolutely sure you want to delete this custom nutrient profile?")) return;
    try {
      const result = await deleteCustomBlueprint(id);
      if (result?.success) { setEditingSchedule(null); loadProfileAndBlueprints(); } else { alert("Deletion failure: Could not clear record."); }
    } catch (err) { console.error("Failed to delete blueprint:", err); alert("Deletion failure: Could not clear record."); }
  }

  if (loading) return <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Loading nutrient profiles...</div>;

  return (
    <AppShell>
    <SectionPanel title="Fertigation Schedules & Recipe Blueprints">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-zinc-400">Select your primary feed profile or customize EC targets and dosing ratios.</p>
          <button onClick={handleInitCreate} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Custom Blueprint</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allSchedules.map((schedule) => {
            const isActive = activeFeedLine === schedule.id;
            return (
              <div key={schedule.id} className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${isActive ? "bg-zinc-900 border-emerald-500 shadow-md shadow-emerald-500/10" : "bg-zinc-900/60 border-zinc-800"}`}>
                <div>
                  <div className="flex justify-between items-start"><h4 className="text-sm font-bold text-white">{schedule.brand}</h4>{schedule.isCustom && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Custom</span>}</div>
                  <p className="text-xs text-zinc-400 mt-1">Stage: {schedule.stage}</p>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">Target EC: {schedule.targetEc}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <button onClick={(e) => handleSetActiveLine(schedule.id, e)} className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${isActive ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{isActive ? "Active Blueprint" : "Set Active"}</button>
                  {schedule.isCustom && <div className="flex items-center gap-2"><button onClick={() => setEditingSchedule(schedule)} className="p-1 text-zinc-400 hover:text-white transition"><Edit className="w-4 h-4" /></button><button onClick={() => handleDelete(schedule.id)} className="p-1 text-red-400 hover:text-red-300 transition"><Trash2 className="w-4 h-4" /></button></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionPanel>
    </AppShell>

  );
}
