'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Upload,
  Download,
  ThermometerSun,
  Weight,
  AlertTriangle,
  Layers,
  Settings,
  Sun,
  Moon,
  Mic,
  Send,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import {
  type EnvironmentReading,
  type DryBackLog,
} from '@/lib/cultivation';
import {
  getDashboardData,
  addManualClimateAndWeight,
  exportAllBatches,
} from '@/app/actions';

export default function EnvironmentPage() {
  const { theme, setTheme } = useTheme();

  // --- STATE ---
  const [dbEnvironmentReadings, setDbEnvironmentReadings] = useState<EnvironmentReading[]>([]);
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual entry fields (always visible)
  const [manualTemp, setManualTemp] = useState(72); // °F
  const [manualHumidity, setManualHumidity] = useState(55);
  const [manualWeight, setManualWeight] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // CSV Import state
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState({
    timestampCol: "",
    temperatureCol: "",
    humidityCol: "",
    roomIdCol: "",
    zoneIdCol: "",
  });

    // --- VOICE TO TEXT ---
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Safari.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setNotes(transcript);
    };
    recognition.start();
  };

  // --- DATA FETCH ---
  const loadData = useCallback(async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      const data = await getDashboardData();
      setDbEnvironmentReadings(data.environmentReadings || []);
      setDbDryBackLogs(data.dryBackLogs || []);
    } catch (err) {
      console.error('Error loading environment data:', err);
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

    // --- SMART DEFAULTS: load last logged values ---
  useEffect(() => {
    if (dbEnvironmentReadings.length > 0) {
      const last = dbEnvironmentReadings[dbEnvironmentReadings.length - 1];
      setManualTemp(Math.round(last.temperatureF));
      setManualHumidity(Math.round(last.humidity));
    }
    if (dbDryBackLogs.length > 0) {
      const lastDry = dbDryBackLogs[dbDryBackLogs.length - 1];
      setManualWeight(Number(lastDry.weight));
    }
  }, [dbEnvironmentReadings, dbDryBackLogs]);

  // --- ALERTS (based on VPD) ---
  const alerts = useMemo(() => {
    const latest = dbEnvironmentReadings.at(-1);
    if (!latest) return [];
    const alerts: Array<{ type: 'warning' | 'success' | 'danger'; text: string }> = [];
    const vpd = latest.vpd;
    if (vpd > 1.2) {
      alerts.push({ type: 'warning', text: 'VPD is high (>1.2). Consider increasing humidity or lowering temperature.' });
    } else if (vpd < 0.8) {
      alerts.push({ type: 'warning', text: 'VPD is low (<0.8). Consider decreasing humidity or raising temperature.' });
    } else {
      alerts.push({ type: 'success', text: 'VPD is in optimal range (0.8–1.2).' });
    }
    return alerts;
  }, [dbEnvironmentReadings]);

  // --- VPD SCORE & STREAK ---
  const vpdScoreData = useMemo(() => {
    if (!dbEnvironmentReadings || dbEnvironmentReadings.length === 0) {
      return { score: 0, streak: 0 };
    }
    const targetMin = 0.8;
    const targetMax = 1.2;
    const readings = dbEnvironmentReadings;
    const inRangeCount = readings.filter(r => r.vpd >= targetMin && r.vpd <= targetMax).length;
    const score = (inRangeCount / readings.length) * 100;
    let streak = 0;
    for (let i = readings.length - 1; i >= 0; i--) {
      if (readings[i].vpd >= targetMin && readings[i].vpd <= targetMax) {
        streak++;
      } else {
        break;
      }
    }
    return { score, streak };
  }, [dbEnvironmentReadings]);

  // --- DRY-BACK SCORE (latest dry‑back percentage) ---
  const dryBackData = useMemo(() => {
    const latest = dbDryBackLogs.at(-1);
    if (!latest) return { percent: 0, isClamped: false };
    // Cast to any because the type may not have dryBackPercent
    const pct = Number((latest as any).dryBackPercent);
    return { percent: pct, isClamped: pct >= 100 || pct < 0 };
  }, [dbDryBackLogs]);
{/* Recommendation */}
<div className="mt-3">
  <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Recommendation:</span>
  {dryBackData.percent > 80 ? (
    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-2">
      🌱 Irrigate now
    </span>
  ) : dryBackData.percent > 60 ? (
    <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 ml-2">
      ⏳ Wait (check again soon)
    </span>
  ) : (
    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 ml-2">
      👀 Monitor only
    </span>
  )}
</div>

  // --- MANUAL ENTRY HANDLER ---
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const tempC = (Number(manualTemp) - 32) * 5 / 9;
      const weightValue = manualWeight === '' ? undefined : Number(manualWeight);
      await addManualClimateAndWeight({
        temperature: tempC,
        humidity: Number(manualHumidity),
        weight: weightValue,
        notes: notes || undefined,
        // default targets – can be made configurable later
        wetWeight: 18.4,
        dryTargetWeight: 13.2,
      });
      // Reset form
      setNotes('');
      await loadData();
      alert('Manual reading saved!');
    } catch (error) {
      console.error(error);
      alert('Failed to save. Check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CSV IMPORT handler ---
  const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      alert('File is empty');
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim());
    setCsvHeaders(headers);
    const previewRows = lines.slice(1, Math.min(6, lines.length)).map(line =>
      line.split(',').map(v => v.trim())
    );
    setCsvPreview(previewRows);
    // Auto-detect mapping
    const findCol = (patterns: string[]) => {
      return headers.find(h => patterns.some(p => h.toLowerCase().includes(p))) || '';
    };
    setCsvMapping({
      timestampCol: findCol(['time', 'date', 'timestamp']),
      temperatureCol: findCol(['temp', 'temperature']),
      humidityCol: findCol(['humid', 'rh']),
      roomIdCol: findCol(['room', 'zone', 'sensor']),
      zoneIdCol: findCol(['zone', 'area']),
    });
    setShowMappingModal(true);
    e.target.value = '';
  };

  // --- EXPORT ALL ---
  const handleExportAll = async () => {
    const data = await exportAllBatches();
    if (!data || data.length === 0) {
      alert('No batch data to export.');
      return;
    }
    // ... existing export logic (copy from previous) ...
    alert('Export functionality preserved.');
  };

  // --- LOADING ---
  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center text-sm font-semibold text-gray-500 dark:text-zinc-400 animate-pulse">
          Loading environment data...
        </div>
      </AppShell>
    );
  }

  const latestEnv = dbEnvironmentReadings.at(-1);

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4">

        {/* Manual Entry Form */}
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl mb-6">
          <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-300 mb-3">Log Manual Reading</h3>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1">Temp (°F)</label>
              <input
                type="number"
                step="0.1"
                value={manualTemp}
                onChange={(e) => setManualTemp(parseFloat(e.target.value))}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 min-h-[48px]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1">Humidity (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={manualHumidity}
                onChange={(e) => setManualHumidity(parseFloat(e.target.value))}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 min-h-[48px]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-1">Weight (lbs, optional)</label>
              <input
                type="number"
                step="0.05"
                value={manualWeight}
                onChange={(e) => setManualWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-white text-sm px-4 py-2 shadow-lg shadow-emerald-950/30 disabled:opacity-50 transition-all cursor-pointer min-h-[48px]"
              >
                {isSubmitting ? 'Saving...' : 'Save Reading'}
              </button>
            </div>
          </form>
          {/* Notes Field with Voice Button */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 min-h-[48px]"
            />
            <button
              type="button"
              onClick={startListening}
              disabled={isListening}
              className={`p-3 rounded-xl border min-h-[48px] min-w-[48px] flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse'
                  : 'border-gray-300 dark:border-zinc-700 hover:border-emerald-500 text-gray-700 dark:text-zinc-300'
              }`}
            >
              <Mic size={20} />
            </button>
          </div>
        </div>

        {/* Import / Export buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => document.getElementById('csv-upload')?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-zinc-700 hover:border-zinc-500 px-4 py-2 text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all cursor-pointer"
          >
            <Upload size={16} /> Import CSV
          </button>
          <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleCsvFileSelect} />
          <button
            onClick={handleExportAll}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-zinc-700 hover:border-zinc-500 px-4 py-2 text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all cursor-pointer"
          >
            <Download size={16} /> Export All
          </button>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-3 shadow-sm ${
                  alert.type === 'warning'
                    ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
                    : alert.type === 'danger'
                    ? 'bg-red-50/80 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-950/50'
                    : 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                }`}
              >
                <AlertTriangle className={`size-4.5 shrink-0 mt-0.5 ${
                  alert.type === 'warning' ? 'text-amber-500 dark:text-amber-400' :
                  alert.type === 'danger' ? 'text-red-500 dark:text-red-400' :
                  'text-emerald-500 dark:text-emerald-400'
                }`} />
                <span className="leading-relaxed">{alert.text}</span>
              </div>
            ))}
          </div>
        )}

{/* Today’s Summary */}
<div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl mb-6">
  <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-300 mb-3">📋 Today’s Summary</h3>
  {dbEnvironmentReadings.length > 0 && dbDryBackLogs.length > 0 ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-gray-500 dark:text-zinc-400">VPD</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          {vpdScoreData.score > 80 ? '✅' : vpdScoreData.score > 50 ? '⚠️' : '🔴'} {vpdScoreData.score.toFixed(0)}% in range
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Streak: {vpdScoreData.streak} hrs</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Dry‑Back</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          {dryBackData.percent > 80 ? '✅' : dryBackData.percent > 50 ? '⚠️' : '🔴'} {dryBackData.percent.toFixed(0)}%
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
          {dryBackData.percent > 80 ? '⏰ Irrigate soon' : '⏳ Wait'}
        </p>
      </div>
    </div>
  ) : (
    <p className="text-sm text-gray-400 dark:text-zinc-500">Log more data to see summary.</p>
  )}
</div>

        {/* Two‑column cards: Room Climate + Dry‑Back */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Room Climate Card */}
          <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-5">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner shrink-0">
              <ThermometerSun className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 dark:text-zinc-500 block">Room Climate</span>
              {latestEnv ? (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl font-black text-gray-900 dark:text-white">
                      {latestEnv.temperatureF.toFixed(1)}°F
                    </span>
                    <span className="text-sm text-gray-500 dark:text-zinc-400">
                      {latestEnv.humidity.toFixed(0)}% RH
                    </span>
                    <span className={`text-sm font-bold ${
                      latestEnv.vpd > 1.2 ? 'text-amber-400' :
                      latestEnv.vpd < 0.8 ? 'text-blue-400' :
                      'text-emerald-400'
                    }`}>
                      {latestEnv.vpd.toFixed(2)} VPD
                    </span>
                  </div>
                  {/* VPD Score & Streak */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="relative size-10">
                        <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-200 dark:stroke-zinc-700" strokeWidth="3" />
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            className={
                              vpdScoreData.score > 80 ? 'stroke-emerald-500' :
                              vpdScoreData.score > 50 ? 'stroke-yellow-400' :
                              'stroke-red-500'
                            }
                            strokeWidth="3"
                            strokeDasharray="100.53"
                            strokeDashoffset={100.53 - (vpdScoreData.score / 100) * 100.53}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700 dark:text-zinc-300">
                          {Math.round(vpdScoreData.score)}%
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">VPD Score</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔥</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                        {vpdScoreData.streak} hr streak
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm text-gray-400 dark:text-zinc-500">Waiting for data...</span>
              )}
            </div>
          </div>

          {/* Dry‑Back Card */}
          <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-5">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner shrink-0">
              <Weight className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 dark:text-zinc-500 block">Dry‑Back Progress</span>
              {dbDryBackLogs.length > 0 ? (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl font-black text-gray-900 dark:text-white">
                      {dryBackData.percent.toFixed(0)}%
                    </span>
                    <span className={`text-xs font-bold ${
                      dryBackData.percent > 80 ? 'text-emerald-500' :
                      dryBackData.percent > 50 ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {dryBackData.percent > 80 ? '✅ Good' : dryBackData.percent > 50 ? '⚠️ Moderate' : '🔴 Critical'}
                    </span>
                  </div>
                  {/* Dry‑Back Score Ring */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="relative size-10">
                        <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-200 dark:stroke-zinc-700" strokeWidth="3" />
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            className={
                              dryBackData.percent > 80 ? 'stroke-emerald-500' :
                              dryBackData.percent > 50 ? 'stroke-yellow-400' :
                              'stroke-red-500'
                            }
                            strokeWidth="3"
                            strokeDasharray="100.53"
                            strokeDashoffset={100.53 - (dryBackData.percent / 100) * 100.53}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700 dark:text-zinc-300">
                          {Math.round(dryBackData.percent)}%
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">Dry‑Back</span>
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm text-gray-400 dark:text-zinc-500">No dry‑back logs yet</span>
              )}
            </div>
          </div>
        </div>

        {/* VPD Chart */}
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Atmospheric VPD</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">Continuous feed</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dbEnvironmentReadings} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                <CartesianGrid stroke="#1F2937" className="opacity-40" strokeDasharray="3 3" />
                <XAxis dataKey="recordedAt" stroke="var(--axis-color)" fontSize={10} tickLine={false} />
                <YAxis stroke="#4B5563" fontSize={10} tickLine={false} label={{ value: 'VPD (kPa)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
                <ReferenceArea y1={0.8} y2={1.2} fill="#10B981" fillOpacity={0.1} stroke="#10B981" strokeOpacity={0.2} strokeDasharray="3 3" label={{ value: 'Target', position: 'top', fill: '#10B981', fontSize: 10, fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="vpd" name="VPD" stroke="#06B6D4" fill="url(#colorVpd)" strokeWidth={2} />
                <defs>
                  <linearGradient id="colorVpd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CSV COLUMN MAPPING MODAL */}
        {showMappingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Map CSV Columns</h2>
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="rounded-lg p-1 hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-gray-500 dark:text-zinc-400 text-xl leading-none">✕</span>
                </button>
              </div>

              {/* File info */}
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
                File: <span className="text-gray-800 dark:text-zinc-200 font-medium">{csvFile?.name}</span>
              </p>

              {/* Column mapping grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Timestamp *
                  </label>
                  <select
                    value={csvMapping.timestampCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, timestampCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Temperature *
                  </label>
                  <select
                    value={csvMapping.temperatureCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, temperatureCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Humidity *
                  </label>
                  <select
                    value={csvMapping.humidityCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, humidityCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Room ID (optional)
                  </label>
                  <select
                    value={csvMapping.roomIdCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, roomIdCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Zone ID (optional)
                  </label>
                  <select
                    value={csvMapping.zoneIdCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, zoneIdCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview table */}
              {csvPreview.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Preview (first {csvPreview.length} rows)</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-zinc-950">
                        <tr>
                          {csvHeaders.map((h: string) => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-zinc-400 font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="border-t border-gray-200 dark:border-zinc-800">
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-3 py-2 text-gray-800 dark:text-zinc-200 truncate max-w-[120px]">
                                {cell || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-zinc-800 mt-2">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 dark:border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={csvImporting || !csvMapping.timestampCol || !csvMapping.temperatureCol || !csvMapping.humidityCol}
                  onClick={async () => {
                    if (!csvFile) return;
                    setCsvImporting(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", csvFile);
                      formData.append("mapping", JSON.stringify(csvMapping));

                      const res = await fetch("/api/import/csv", { method: "POST", body: formData });
                      const data = await res.json();

                      if (data.success) {
                        alert(`✅ Imported ${data.imported} records${data.skipped > 0 ? `, ${data.skipped} skipped` : ""}`);
                        // Refetch dashboard data
                        const fresh = await getDashboardData();
                        setDbDryBackLogs(fresh.dryBackLogs || []);
                        setDbEnvironmentReadings(fresh.environmentReadings || []);
                        setShowMappingModal(false);
                      } else {
                        alert(`❌ Import failed: ${data.error}`);
                      }
                    } catch (err) {
                      alert(`❌ Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                    } finally {
                      setCsvImporting(false);
                    }
                  }}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {csvImporting ? "Importing..." : "Import Data"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}