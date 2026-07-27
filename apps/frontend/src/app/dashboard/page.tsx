'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Upload,
  Download,
  Layers,
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
import {
  type EnvironmentReading,
  type DryBackLog,
  calculateDryBack,
} from '@/lib/cultivation';
import Link from 'next/link';

// Modular Server Actions
import {
  getDashboardData,
  addManualClimateAndWeight,
} from '@/app/actions/loggingreadings';
import { generateDailyBriefing } from '@/app/actions/dailyinsights';
import { useTelemetry } from '@/lib/telemetry-context';
import { MorningBrief } from '@/components/MorningBrief';
import { DailyCheckIn } from '@/components/dashboard/DailyCheckIn';

export default function DashboardPage() {
  const { setData } = useTelemetry();

  // --- STATE ---
  const [dbEnvironmentReadings, setDbEnvironmentReadings] = useState<EnvironmentReading[]>([]);
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestIrrigation, setLatestIrrigation] = useState<any>(null);

  // AI Briefing state
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [lastBriefingTime, setLastBriefingTime] = useState<string>('Not yet generated');
  const [briefingSnapshot, setBriefingSnapshot] = useState<string | null>(null);
  const [briefingAttention, setBriefingAttention] = useState<string[]>([]);
  const [briefingActions, setBriefingActions] = useState<string[]>([]);

  // CSV Import state
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState({
    timestampCol: '',
    temperatureCol: '',
    humidityCol: '',
    roomIdCol: '',
    zoneIdCol: '',
  });

  const hasLoaded = useRef(false);
  const hasFetchedBriefingInitially = useRef(false);

  // --- DATA FETCH ---
  const loadData = useCallback(
    async (skipLoading = false) => {
      try {
        if (!skipLoading) setLoading(true);
        const data = await getDashboardData();
        setDbEnvironmentReadings(data.environmentReadings || []);
        setDbDryBackLogs(data.dryBackLogs || []);
        setLatestIrrigation(data.latestIrrigation || null);

        // Build activeDryBack from the latest log (if any)
        let activeDryBack = undefined;
        if (data.dryBackLogs && data.dryBackLogs.length > 0) {
          const latest = data.dryBackLogs[data.dryBackLogs.length - 1];
          const wet = 18.4;
          const dry = 13.2;
          const calc = calculateDryBack({
            id: 'active',
            cultivar: 'Environment',
            containerGallons: 5,
            wetWeight: wet,
            dryTarget: dry,
            weight: Number(latest.weight),
            loggedAt: new Date().toISOString(),
          });
          activeDryBack = {
            dryBackPercent: calc.dryBackPercent,
            estimatedHoursUntilWater: calc.estimatedHoursUntilWater,
            poundsUntilIrrigation: calc.poundsUntilIrrigation,
          };
        }

        // Push data to the global telemetry context
        setData({
          latestEnvironment: data.environmentReadings?.[data.environmentReadings.length - 1],
          activeDryBack,
          latestRunoffEc: data.latestIrrigation?.ec,
        });
      } catch (err) {
        console.error('Error loading environment data:', err);
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [setData]
  );

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    loadData();
  }, [loadData]);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // --- AI BRIEFING ---
  const loadBriefing = useCallback(async (force = false) => {
    if (!force && hasFetchedBriefingInitially.current) return;

    setBriefingLoading(true);
    setBriefingError(null);

    try {
      const result = await generateDailyBriefing(force);
      if (result.success) {
        setBriefingSnapshot(result.snapshot || null);
        setBriefingAttention(result.attention || []);
        setBriefingActions(result.actions || []);        
        setLastBriefingTime(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        hasFetchedBriefingInitially.current = true;
      } else {
        setBriefingError(result.error || 'Failed to load briefing');
        setLastBriefingTime('Failed');
      }
    } catch (err) {
      console.error('Failed to load briefing:', err);
      setBriefingError('Failed to load briefing');
      setLastBriefingTime('Failed');
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  // Trigger initial briefing fetch once dashboard data finishes loading
  useEffect(() => {
    if (!loading && !hasFetchedBriefingInitially.current) {
      if (dbEnvironmentReadings.length === 0 && dbDryBackLogs.length === 0) {
        setBriefing('📊 Log some data first, then AI will provide a daily summary.');
        setLastBriefingTime('Not applicable');
        return;
      }
      loadBriefing(false);
    }
  }, [loading, dbEnvironmentReadings.length, dbDryBackLogs.length, loadBriefing]);

  // --- CSV IMPORT handler ---
  const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      alert('File is empty');
      return;
    }
    const headers = lines[0].split(',').map((h) => h.trim());
    setCsvHeaders(headers);
    const previewRows = lines.slice(1, Math.min(6, lines.length)).map((line) =>
      line.split(',').map((v) => v.trim())
    );
    setCsvPreview(previewRows);
    const findCol = (patterns: string[]) => {
      return headers.find((h) => patterns.some((p) => h.toLowerCase().includes(p))) || '';
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

return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-4 space-y-6">
        
        {/* Daily AI Briefing */}
        <div>
          <MorningBrief
            snapshot={briefingSnapshot}
            attention={briefingAttention}
            actions={briefingActions}
            lastBriefingTime={lastBriefingTime}
            isRefreshing={briefingLoading}
            onRefresh={() => loadBriefing(true)}
          />
        </div>

        {/* Nav to Check-In Page */}
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition-all">
            Log a Reading
          </Link>
        </div>

        {/* Import / Export controls */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => document.getElementById('csv-upload')?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-zinc-700 hover:border-zinc-500 px-4 py-2 text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all cursor-pointer"
          >
            <Upload size={16} /> Import CSV
          </button>
          <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleCsvFileSelect} />
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

        {/* CSV Modal */}
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

              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
                File: <span className="text-gray-800 dark:text-zinc-200 font-medium">{csvFile?.name}</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Timestamp *</label>
                  <select
                    value={csvMapping.timestampCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, timestampCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Temperature *</label>
                  <select
                    value={csvMapping.temperatureCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, temperatureCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Humidity *</label>
                  <select
                    value={csvMapping.humidityCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, humidityCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Room ID (optional)</label>
                  <select
                    value={csvMapping.roomIdCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, roomIdCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Zone ID (optional)</label>
                  <select
                    value={csvMapping.zoneIdCol}
                    onChange={(e) => setCsvMapping({ ...csvMapping, zoneIdCol: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {csvPreview.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Preview</p>
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
                        alert(`✅ Imported ${data.imported} records`);
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
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-emerald-950/30"
                >
                  {csvImporting ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
