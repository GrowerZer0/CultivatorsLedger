"use client";

import { useState } from "react";
import { saveLight } from "@/server/actions/lights";
import { Sun, Save } from "lucide-react";

export function LightSettingsForm({ initialLights }: { initialLights: any[] }) {
  const [lights, setLights] = useState(initialLights);
  const [isSaving, setIsSaving] = useState(false);
  
  const activeLight = lights[0] || {
    name: "VIVOSUN 200W",
    wattage: 200,
    dimmerPercent: 50,
    distanceInches: 24,
    scheduleHoursOn: 18,
    type: "led_full_spectrum"
  };

  const [formData, setFormData] = useState(activeLight);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await saveLight(formData);
    if (!res.success) alert(res.error);
    setIsSaving(false);
  };

  const effectiveWattage = (formData.wattage * formData.dimmerPercent) / 100;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      
      {/* Name & Wattage */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase text-zinc-500">Light Name</label>
          <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1 dark:bg-zinc-800" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-zinc-500">Max Wattage</label>
          <input name="wattage" type="number" value={formData.wattage} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Current Settings */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div>
          <label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1"><Sun className="size-3"/> Dimmer %</label>
          <input name="dimmerPercent" type="number" min="0" max="100" value={formData.dimmerPercent} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-zinc-500">Distance (in)</label>
          <input name="distanceInches" type="number" value={formData.distanceInches || ""} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-zinc-500">Hours On</label>
          <input name="scheduleHoursOn" type="number" min="1" max="24" value={formData.scheduleHoursOn} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1 dark:bg-zinc-900" />
        </div>
      </div>

      <div className="text-sm text-zinc-500 font-medium">
        Effective Power: <span className="text-emerald-500 font-bold">{effectiveWattage.toFixed(0)}W</span>
      </div>

      <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold">
        <Save className="size-4" /> {isSaving ? "Saving..." : "Save Light Settings"}
      </button>
    </div>
  );
}