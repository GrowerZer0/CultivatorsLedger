"use client";

import { useState, useEffect } from "react";
import { getDrybackSettings, updateDrybackSettings, type DrybackSettings } from "@/server/actions/dryback-settings";

const EXAMPLE_WET_WEIGHT = 21;

export function DrybackSettingsCard() {
  const [settings, setSettings] = useState<DrybackSettings>({
    seedling: 5,
    veg: 6,
    flowering: 20,
    harvest: 25,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getDrybackSettings();
        setSettings(data);
      } catch (err) {
        console.error("Failed to load dryback settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateDrybackSettings(settings);
      if (result.success) {
        setMessage({ type: "success", text: "Dryback targets saved." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Unexpected error." });
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof DrybackSettings, raw: string) {
    const num = raw === "" ? 0 : parseFloat(raw);
    setSettings((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
  }

  if (loading) {
    return (
      <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">
        Loading grow settings...
      </div>
    );
  }

  const fields: Array<{ key: keyof DrybackSettings; label: string }> = [
    { key: "seedling", label: "Seedling" },
    { key: "veg", label: "Vegetative" },
    { key: "flowering", label: "Flowering" },
  ];

  const previewDryTarget = EXAMPLE_WET_WEIGHT * (1 - settings.flowering / 100);

  return (
      <div className="space-y-6 max-w-xl">
        {message && (
          <div
            className={`p-3 rounded-lg text-xs ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-white">Stage Dryback Targets</h4>
          <p className="text-xs text-zinc-400 mt-1">
            These values tell the app when to alert you to water. Each plant uses the value
            for its current growth stage unless it has a manual override.
            <span className="block mt-1 text-zinc-500">
              Not the same as harvest timing — that&apos;s your call based on the plant itself.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-zinc-300">{label}</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                />
                <span className="text-xs text-zinc-500">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <p className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Preview:</span> With flowering at{" "}
            <span className="text-emerald-400 font-mono">{settings.flowering}%</span>, a plant at
            FC <span className="text-zinc-300 font-mono">{EXAMPLE_WET_WEIGHT.toFixed(2)} lbs</span> would
            have a dry target of{" "}
            <span className="text-emerald-400 font-mono">{previewDryTarget.toFixed(2)} lbs</span>{" "}
            — the app will flag &quot;water now&quot; when the plant reaches that weight.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition"
          >
            {saving ? "Saving..." : "Save Grow Settings"}
          </button>
        </div>
      </div>
  );
}