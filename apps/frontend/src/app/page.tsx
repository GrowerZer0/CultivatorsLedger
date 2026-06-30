'use client';

import {
  Activity,
  Droplets,
  Gauge,
  Plus,
  Sprout,
  ThermometerSun,
  Weight,
  Cpu,
  Keyboard,
  AlertTriangle,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Layers,
  Upload
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { ChartFrame } from "@/components/layout/ChartFrame";
import { MetricCard } from "@/components/layout/MetricCard";
import { SectionPanel } from "@/components/layout/SectionPanel";
import {
  averageVpd,
  calculateDryBack,
  calculateReservoirDelta,
  commercialFeedSchedules,
  type DryBackLog,
  type EnvironmentReading,
  type FeedSchedule,
  type NutrientDose
} from "@/lib/cultivation";
import { addDryBackLog, getDashboardData, getUserProfile, getCustomBlueprints, addManualClimateLog } from "@/app/actions";
import AIChatWidget from "@/components/AIChatWidget";

export default function Page() {
  // --- 1. CONFIGURATION PROFILE STATE ---
  const [profile, setProfile] = useState({
    experienceLevel: "Beginner",
    hasEcmeter: true,
    hasScales: true,
    hasClimateHub: true
  });

  // --- 2. LIVE DATABASE TELEMETRY STATES ---
  const [dbDryBackLogs, setDbDryBackLogs] = useState<DryBackLog[]>([]);
  const [dbEnvironmentReadings, setDbEnvironmentReadings] = useState<EnvironmentReading[]>([]);
  const [customBlueprints, setCustomBlueprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTemp, setManualTemp] = useState(22);
  const [manualHumidity, setManualHumidity] = useState(60);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // --- 3. CORE INPUT CALCULATOR STATES ---
  const [containerGallons, setContainerGallons] = useState(5);
  const [wetWeight, setWetWeight] = useState(18.4);
  const [dryTargetWeight, setDryTargetWeight] = useState(13.2);
  const [currentWeight, setCurrentWeight] = useState(14.2);
  const [reservoirGallons, setReservoirGallons] = useState(40);
  const [leftoverGallons, setLeftoverGallons] = useState(11.5);
  const [currentEc, setCurrentEc] = useState(1.4);
  const [isSaving, setIsSaving] = useState(false);
  
  // --- CSV Import Column Mapping State ---
const [showMappingModal, setShowMappingModal] = useState(false);
const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
const [csvPreview, setCsvPreview] = useState<string[][]>([]);
const [csvFile, setCsvFile] = useState<File | null>(null);
const [csvMapping, setCsvMapping] = useState({
  timestampCol: "",
  temperatureCol: "",
  humidityCol: "",
  roomIdCol: "",
  zoneIdCol: "",
});
const [csvImporting, setCsvImporting] = useState(false);

  // LOCAL DROPDOWN OVERRIDE STATE
  const [activeLineId, setActiveLineId] = useState("ff-trio");

  // DUAL INGESTION MODE STATE
  const [isSensorDriven, setIsSensorDriven] = useState(false);

  // --- LIVE BLUEPRINT MERGE MATRIX ENGINE ---
  const combinedSchedules = useMemo<FeedSchedule[]>(() => {
    const baseMerged = commercialFeedSchedules.map(s => {
      const match = customBlueprints.find(cb => cb.id === s.id);
      return match ? {
        ...s,
        id: match.id,
        brand: match.brand,
        stage: match.stage,
        targetEc: match.target_ec,
        doses: match.doses_json as NutrientDose[]
      } : s;
    });

    const completelyNewCustom = customBlueprints
      .filter(cb => !commercialFeedSchedules.find(s => s.id === cb.id))
      .map(cb => ({
        id: cb.id,
        brand: cb.brand,
        label: cb.brand,
        stage: cb.stage,
        targetEc: cb.target_ec,
        targetPh: 5.8,
        doses: cb.doses_json as NutrientDose[]
      }));

    return [...baseMerged, ...completelyNewCustom];
  }, [customBlueprints]);

  // --- 4. DYNAMIC SCHEDULE SELECTOR ---
  const activeSchedule = useMemo<FeedSchedule>(() => {
    return combinedSchedules.find((s) => s.id === activeLineId) || combinedSchedules[0] || commercialFeedSchedules[0];
  }, [activeLineId, combinedSchedules]);

  // --- 5. REAL-TIME DATA FETCH LOOP ---
  const loadData = useCallback(async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      const data = await getDashboardData();
      console.log("📊 data from API:", data);
      setDbDryBackLogs(data.dryBackLogs || []);
      setDbEnvironmentReadings(data.environmentReadings || []);
      console.log("🔄 setDbEnvironmentReadings called with:", data.environmentReadings.length, "items");
      const blueprints = await getCustomBlueprints();
      setCustomBlueprints(blueprints || []);
    
      const activeProfile = await getUserProfile() as any;
      if (activeProfile) {
        setProfile({
          experienceLevel: activeProfile.experienceLevel || "Beginner",
          hasEcmeter: activeProfile.hasEcmeter,
          hasScales: activeProfile.hasScales,
          hasClimateHub: activeProfile.hasClimateHub
        });
      }
    } catch (err) {
      console.error("Error running dashboard sync updates:", err);
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("📈 state updated:", {
      count: dbEnvironmentReadings.length,
      last: dbEnvironmentReadings.at(-1),
    });
  }, [dbEnvironmentReadings]);

  // Initial load (spinner shown)
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll every 10 seconds (silent refresh – no spinner)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("⏰ poll fired");
      loadData(true); // skipLoading = true
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [loadData]);

  // --- 6. DATA PERSISTENCE HANDLER ---
  async function handleSaveLog() {
    setIsSaving(true);
    try {
      await addDryBackLog({
        cultivar: "Blueberry Muffin",
        containerGallons,
        wetWeight,
        dryTargetWeight,
        weight: effectiveWeight, 
        runoff_ec: profile.hasEcmeter ? 2.2 : 0 
      });
      alert("Dry-back log successfully saved to Supabase!");
      const data = await getDashboardData();
      setDbDryBackLogs(data.dryBackLogs || []);
    } catch (error) {
      console.error("Failed to commit ledger entry:", error);
    } finally {
      setIsSaving(false);
    }
  }

  // --- TELEMETRY STREAM BINDINGS ---
  const latestTelemetryPacket = useMemo(() => {
    if (!dbEnvironmentReadings || dbEnvironmentReadings.length === 0) return null;
    return dbEnvironmentReadings[dbEnvironmentReadings.length - 1] as Record<string, any>;
  }, [dbEnvironmentReadings]);

  const sensorWeight = latestTelemetryPacket && typeof latestTelemetryPacket.dry_back !== 'undefined' && latestTelemetryPacket.dry_back !== null
    ? Number(latestTelemetryPacket.dry_back)
    : (dbDryBackLogs[dbDryBackLogs.length - 1]?.weight ?? 14.5);

  const sensorEc = latestTelemetryPacket && typeof latestTelemetryPacket.runoff_ec !== 'undefined' && latestTelemetryPacket.runoff_ec !== null
    ? Number(latestTelemetryPacket.runoff_ec)
    : (dbDryBackLogs[dbDryBackLogs.length - 1]?.runoff_ec ?? 1.45);

  const effectiveWeight = isSensorDriven ? sensorWeight : currentWeight;
  const effectiveEc = isSensorDriven ? sensorEc : currentEc;
  
  const currentTemperature = latestTelemetryPacket && (latestTelemetryPacket.temperatureF ?? latestTelemetryPacket.temperature) !== undefined && (latestTelemetryPacket.temperatureF ?? latestTelemetryPacket.temperature) !== null
    ? Number(latestTelemetryPacket.temperatureF ?? latestTelemetryPacket.temperature).toFixed(1)
    : "78.5";
    
  const currentHumidity = latestTelemetryPacket && typeof latestTelemetryPacket.humidity !== 'undefined' && latestTelemetryPacket.humidity !== null
    ? Number(latestTelemetryPacket.humidity).toFixed(0) 
    : "60";

  // --- 7. CROP-STEERING CALCULATIONS ---
  const activeDryBack = useMemo(() => {
    return calculateDryBack({
      id: "active",
      cultivar: "Active room",
      containerGallons,
      wetWeight,
      dryTargetWeight,
      weight: effectiveWeight,
      loggedAt: new Date().toISOString()
    });
  }, [containerGallons, effectiveWeight, dryTargetWeight, wetWeight]);

  const reservoirDelta = useMemo(() => {
    return calculateReservoirDelta({
      reservoirGallons,
      leftoverGallons,
      doses: activeSchedule.doses,
      currentEc: effectiveEc,
      targetEc: activeSchedule.targetEc
    });
  }, [activeSchedule.doses, activeSchedule.targetEc, effectiveEc, leftoverGallons, reservoirGallons]);

  // --- AUTOMATED REAL-TIME GROW ALERTS ENGINE ---
  const dynamicGrowAlerts = useMemo(() => {
    const alerts: Array<{ type: "danger" | "warning" | "success" | "neutral" | "critical"; text: string }> = [];
    
    if (reservoirDelta.alerts && reservoirDelta.alerts.length > 0) {
      reservoirDelta.alerts.forEach(msg => {
        alerts.push({ type: reservoirDelta.isCriticalClamp ? "critical" : "warning", text: msg });
      });
    }

    if (activeDryBack.alerts && activeDryBack.alerts.length > 0) {
      activeDryBack.alerts.forEach(msg => {
        alerts.push({ type: "danger", text: msg });
      });
    }

    if (effectiveEc > 2.5) {
      alerts.push({
        type: "warning",
        text: `High Substrate Salt Accumulation (${effectiveEc.toFixed(2)} EC). Dilute next input feed volume.`
      });
    }

    if (activeDryBack.dryBackPercent >= 85) {
      alerts.push({
        type: "critical",
        text: `Critical dry-back limit (${activeDryBack.dryBackPercent.toFixed(0)}%). Root-zone wilting stress imminent.`
      });
    } else if (activeDryBack.dryBackPercent > 60) {
      alerts.push({
        type: "success",
        text: `Generative steering window active (${activeDryBack.dryBackPercent.toFixed(0)}%). Safe irrigation point confirmed.`
      });
    }

    return alerts;
  }, [effectiveEc, activeDryBack, reservoirDelta]);

  const dryBackChartData = dbDryBackLogs.map((log) => ({
    time: new Date(log.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    weight: log.weight,
    runoff_ec: log.runoff_ec ?? 0
  }));

  // Manual entry submission handler
async function handleManualSubmit(e: React.FormEvent) {
  e.preventDefault();
  setIsSubmittingManual(true);
  try {
    const result = await addManualClimateLog({
      temperature: manualTemp,
      humidity: manualHumidity,
    });
    if (result.success) {
      // Refetch dashboard data to show the new entry
      const data = await getDashboardData();
      setDbDryBackLogs(data.dryBackLogs || []);
      setDbEnvironmentReadings(data.environmentReadings || []);
      setShowManualForm(false);
      // Reset form to default values
      setManualTemp(22);
      setManualHumidity(60);
    }
  } catch (error) {
    console.error("Failed to submit manual log:", error);
    alert("Failed to save manual entry. Check console for details.");
  } finally {
    setIsSubmittingManual(false);
  }
}

// CSV file selection handler – reads headers and preview rows
async function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  setCsvFile(file);
  const text = await file.text();
  const lines = text.split("\n").filter(line => line.trim() !== "");
  if (lines.length === 0) {
    alert("File is empty");
    return;
  }
  
  // Parse headers
  const headers = lines[0].split(",").map(h => h.trim());
  setCsvHeaders(headers);
  
  // Parse first 5 rows for preview (or all if less)
  const previewRows = lines.slice(1, Math.min(6, lines.length)).map(line => 
    line.split(",").map(v => v.trim())
  );
  setCsvPreview(previewRows);
  
  // Auto-detect common column names
  const findCol = (patterns: string[]) => {
    return headers.find(h => patterns.some(p => h.toLowerCase().includes(p))) || "";
  };
  
  setCsvMapping({
    timestampCol: findCol(["time", "date", "timestamp"]),
    temperatureCol: findCol(["temp", "temperature"]),
    humidityCol: findCol(["humid", "rh"]),
    roomIdCol: findCol(["room", "zone", "sensor"]),
    zoneIdCol: findCol(["zone", "area"]),
  });
  
  setShowMappingModal(true);
  e.target.value = ""; // reset input
}

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center bg-[#0B0F19] text-sm font-semibold text-zinc-400 tracking-wide animate-pulse">
          Initializing secure telemetry pipelines and core ledger nodes...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0B0F19] text-zinc-100 p-1 lg:p-4 font-sans selection:bg-emerald-500/30">
        
        {/* TOP COMMAND NAVIGATION BAR */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">
                Production Environment
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">Facility Control Room</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Real-time telemetry aggregation and structural crop-steering optimization arrays.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowManualForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
              Log Manual Reading
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("csv-upload")?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 hover:border-zinc-500 px-4 py-2 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
            >
            <Upload className="size-4" />
              Import CSV
            </button>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvFileSelect}
            />
          </div>

          {/* SENSOR INGESTION MASTER CONTROL */}
          <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 self-start md:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => setIsSensorDriven(false)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !isSensorDriven 
                  ? "bg-zinc-800 text-white shadow-md ring-1 ring-zinc-700/50" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Keyboard className="size-3.5" /> Manual Ledger Mode
            </button>
            <button
              type="button"
              onClick={() => setIsSensorDriven(true)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isSensorDriven 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20 ring-1 ring-emerald-500/30" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Cpu className="size-3.5" /> Hardware Stream Active
            </button>
          </div>
        </header>

        {/* INCIDENT REPORT & FAULT MONITOR LINE */}
        {dynamicGrowAlerts.length > 0 && (
          <div className="mb-6 grid gap-2">
            {dynamicGrowAlerts.map((alert, idx) => (
              <div 
                key={idx}
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-3 shadow-sm transition-all duration-300 ${
                  alert.type === "critical" ? "bg-red-950/30 text-red-300 border-red-900/60 ring-1 ring-red-500/10" :
                  alert.type === "danger" ? "bg-red-950/20 text-red-400 border-red-950/50" :
                  alert.type === "warning" ? "bg-amber-950/30 text-amber-300 border-amber-900/40" :
                  alert.type === "success" ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40" :
                  "bg-zinc-900/50 text-zinc-300 border-zinc-800"
                }`}
              >
                {alert.type === "critical" ? (
                  <ShieldAlert className="size-4.5 shrink-0 text-red-400 animate-pulse mt-0.5" />
                ) : (
                  <AlertTriangle className={`size-4.5 shrink-0 mt-0.5 ${
                    alert.type === "danger" || alert.type === "warning" ? "text-amber-500" : "text-emerald-400"
                  }`} />
                )}
                <div className="flex-1">
                  {alert.type === "critical" && <span className="font-extrabold text-[10px] uppercase tracking-wider text-red-400 block mb-0.5">Automated Facility Intervention</span>}
                  <span className="leading-relaxed">{alert.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 📊 HIGH-DENSITY PRIMARY TELEMETRY GAUGES */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
          {profile.hasScales && (
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
                <Weight className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 block">Dry-Back Progress</span>
                <span className="text-2xl font-black text-white block mt-0.5">{activeDryBack.dryBackPercent.toFixed(0)}%</span>
                <span className="text-[11px] text-zinc-400 block truncate mt-0.5">{activeDryBack.poundsUntilIrrigation.toFixed(1)} lbs to target limit</span>
              </div>
            </div>
          )}

          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-inner">
              <Droplets className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 block">Reservoir Refill</span>
              <span className="text-2xl font-black text-white block mt-0.5">{reservoirDelta.topOffGallons} Gal</span>
              <span className="text-[11px] text-zinc-400 block truncate mt-0.5">{reservoirDelta.waterPercentToAdd}% of tank capacity empty</span>
            </div>
          </div>

          {profile.hasClimateHub && (
  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl flex items-center gap-4">
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner">
      <ThermometerSun className="size-6" />
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 block">Room Climate</span>
      {dbEnvironmentReadings.length > 0 ? (
        <>
          <span className="text-2xl font-black text-white block mt-0.5">
            {(dbEnvironmentReadings.at(-1)?.temperatureF ?? 0).toFixed(1)}°F
          </span>
          <span className="text-[11px] text-zinc-400 block truncate mt-0.5">
            {(dbEnvironmentReadings.at(-1)?.humidity ?? 0).toFixed(0)}% RH • {(dbEnvironmentReadings.at(-1)?.vpd ?? 0).toFixed(2)} VPD
          </span>
        </>
      ) : (
        <span className="text-sm text-zinc-500 block mt-0.5">Waiting for data...</span>
      )}
    </div>
  </div>
)}

          {profile.hasEcmeter && (
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shadow-inner">
                <Gauge className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 block">Substrate Runoff EC</span>
                <span className="text-2xl font-black text-white block mt-0.5">{effectiveEc.toFixed(2)}</span>
                <span className="text-[11px] text-zinc-400 block truncate mt-0.5">{isSensorDriven ? "Inline hardware streaming" : "Manual entry log"}</span>
              </div>
            </div>
          )}
        </div>

        {/* 🎛️ TWO-COLUMN OPERATIONAL CONTROL GRID */}
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr] mb-6">
          
          {/* COLUMN 1: ANALYTICS VAULT */}
          <div className="space-y-6">
            {profile.hasScales && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Media Dryback Cycle Log</h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{dbDryBackLogs.length} points</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dryBackChartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                      <CartesianGrid stroke="#1F2937" className="opacity-40" strokeDasharray="3 3" />
                      <XAxis dataKey="time" stroke="#4B5563" fontSize={10} tickLine={false} />
                      <YAxis stroke="#4B5563" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="weight" name="Weight (lbs)" stroke="#10B981" strokeWidth={2.5} dot={false} />
                      {profile.hasEcmeter && (
                        <Line type="monotone" dataKey="runoff_ec" name="Runoff EC" stroke="#F97316" strokeWidth={1.5} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {profile.hasClimateHub && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Atmospheric Vapor Deficit ($VPD$)</h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">Continuous feed</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                  <AreaChart key={dbEnvironmentReadings.length} data={dbEnvironmentReadings} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>                      <XAxis dataKey="recordedAt" stroke="#4B5563" fontSize={10} tickLine={false} />
                      <YAxis stroke="#4B5563" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="vpd" name="VPD" stroke="#06B6D4" fill="url(#colorVpd)" strokeWidth={2} />
                      <defs>
                        <linearGradient id="colorVpd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* COLUMN 2: OPERATIONS SYSTEM CONTROL CONSOLE */}
          <div className="space-y-6">
            
            {/* CALCULATOR LOG CONSOLE */}
            {profile.hasScales && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
                  <Sliders className="size-4 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Precision Dry-Back Analytics</h3>
                    <p className="text-[11px] text-zinc-400">Calibrate volumetric container dry targets down to single grams.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <DarkNumberField label="Container Volume (Gal)" value={containerGallons} onChange={setContainerGallons} />
                  <DarkNumberField label="Target Saturated Weight (Lbs)" value={wetWeight} onChange={setWetWeight} />
                  <DarkNumberField label="Target Dehydrated Weight (Lbs)" value={dryTargetWeight} onChange={setDryTargetWeight} />
                  
                  <div className="grid gap-1">
                    <span className="text-xs font-bold text-zinc-400 tracking-wide">Current Target Weight</span>
                    <input
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-40 disabled:bg-zinc-900 transition-all"
                      type="number"
                      step="0.05"
                      value={effectiveWeight}
                      onChange={(e) => setCurrentWeight(Number(e.target.value))}
                      disabled={isSensorDriven}
                    />
                    {isSensorDriven && <span className="text-[9px] text-emerald-400 font-bold tracking-wider mt-0.5">LOCKED TO HARDWARE SENSOR TELEMETRY</span>}
                  </div>
                </div>

                <div className={`mt-5 rounded-xl p-4 border transition-all ${activeDryBack.isClamped ? "bg-amber-950/20 border-amber-900/50" : "bg-zinc-950/60 border-zinc-800"}`}>
                  <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase ${activeDryBack.isClamped ? "text-amber-400" : "text-emerald-400"}`}>
                    <Activity className="size-3.5" />
                    Watering Window Forecasting Matrix
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                    {activeDryBack.isClamped ? (
                      "Calculations suspended due to telemetry boundary violation error. Re-verify input configurations above."
                    ) : (
                      <>Current root media is <span className="font-bold text-white">{activeDryBack.dryBackPercent.toFixed(1)}%</span> through dry-back cycle target. Estimated irrigation trigger in <span className="font-bold text-emerald-400 underline decoration-emerald-500/30">{activeDryBack.estimatedHoursUntilWater} hours</span>.</>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSaving || activeDryBack.isClamped}
                  onClick={handleSaveLog}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-white text-xs px-4 py-3 shadow-lg shadow-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isSaving ? "Syncing to Cloud Ledger..." : "Commit Diagnostics to Supabase"}
                </button>
              </div>
            )}

            {/* RESERVOIR DOSING CALCULATOR */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Droplets className="size-4 text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Dynamic Reservoir Dosing</h3>
                    <p className="text-[11px] text-zinc-400">Top off system reservoirs while maintaining targeted chemical balances.</p>
                  </div>
                </div>
                
                {/* BRAND SCHEDULE INTERACTIVE SELECTOR */}
                <select
                  value={activeLineId}
                  onChange={(e) => setActiveLineId(e.target.value)}
                  className="text-xs font-bold rounded-lg border border-zinc-800 bg-zinc-950 p-2 outline-none text-zinc-200 cursor-pointer focus:border-cyan-500 transition-all shadow-inner"
                >
                  {combinedSchedules.map((s) => (
                    <option key={s.id} value={s.id} className="bg-zinc-900 text-zinc-100">
                      {s.brand} {s.stage ? `(${s.stage})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <DarkNumberField label="Tank Capacity (Gal)" value={reservoirGallons} onChange={setReservoirGallons} />
                <DarkNumberField label="Current Backlog Vol (Gal)" value={leftoverGallons} onChange={setLeftoverGallons} />
                
                <div className="grid gap-1">
                  <span className="text-xs font-bold text-zinc-400 tracking-wide">Current Solution EC</span>
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-40 disabled:bg-zinc-900 transition-all"
                    type="number"
                    step="0.05"
                    value={effectiveEc}
                    onChange={(e) => setCurrentEc(Number(e.target.value))}
                    disabled={isSensorDriven}
                  />
                  {isSensorDriven && <span className="text-[9px] text-emerald-400 font-bold tracking-wider mt-0.5">LOCKED TO SENSOR</span>}
                </div>
              </div>

              {/* NUTRIENT CONCENTRATE BREAKDOWN OUTPUTS */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeSchedule.doses.map((dose: NutrientDose, index: number) => (
                  <div key={`${dose.product}-${index}`} className="grid gap-3 grid-cols-[1fr_80px_90px] items-center">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 text-zinc-300 px-3 py-2 text-xs truncate font-medium">
                      {dose.product}
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 text-zinc-400 px-2 py-2 text-xs font-mono text-center">
                      {dose.mlPerGallon} mL/g
                    </div>
                    <div className={`rounded-xl border px-3 py-2 text-xs font-black font-mono text-center transition-all ${
                      reservoirDelta.isCriticalClamp 
                        ? "bg-red-950/30 border-red-900/50 text-red-400 shadow-sm" 
                        : "bg-zinc-950 text-orange-400 border-zinc-800"
                    }`}>
                      {reservoirDelta.nutrientsToAdd[index]?.totalMl ?? 0} mL
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM REAL-TIME FACILITY STEERING DIAGNOSTICS MATRICES */}
        <footer className={`rounded-2xl border p-5 shadow-xl transition-all duration-300 ${
          reservoirDelta.isCriticalClamp ? "bg-red-950/20 border-red-900/60" : "border-zinc-800 bg-zinc-900/80"
        }`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${reservoirDelta.isCriticalClamp ? "text-red-400" : "text-emerald-400"}`}>
            <Sprout className="size-4" />
            Dynamic Output Targets Matrix • {activeSchedule.brand} ({activeSchedule.stage})
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-zinc-300 font-medium">
            {effectiveEc === 0 ? (
              <>
                <span className="text-white font-bold">Standard Delivery Protocol:</span> Mix base concentrate solutions straight into fresh top-off water volumes to lock down recipe values at <span className="font-extrabold text-white bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">{activeSchedule.targetEc} EC</span>.
              </>
            ) : (
              <>
                Your targeted system parameters dictate an ambient base blueprint target of <span className="text-white font-bold">{activeSchedule.targetEc} EC</span>. Accounting for residual solution metrics (<span className="text-white font-mono font-bold">{effectiveEc} EC</span>), input volume should be target blended directly to <span className={`font-black font-mono bg-zinc-950 px-1.5 py-0.5 rounded border ${reservoirDelta.isCriticalClamp ? 'text-red-400 border-red-900' : 'text-orange-400 border-zinc-800'}`}>{reservoirDelta.adjustedTopOffEc} EC</span>.
              </>
            )}
          </p>
        </footer>

        {/* COMPREHENSIVE CONTEXT INTERACTIVE DATA DOCK PANEL */}
        <AIChatWidget
          activeDryBack={activeDryBack}
          reservoirDelta={reservoirDelta}
          latestEnvironment={dbEnvironmentReadings.at(-1)}
          latestRunoffEc={dbDryBackLogs.at(-1)?.runoff_ec}
          activeSchedule={activeSchedule}
          leftoverGallons={leftoverGallons}
        />
      </div>

      {/* MANUAL ENTRY MODAL */}
{showManualForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">Manual Climate Log</h2>
        <button
          type="button"
          onClick={() => setShowManualForm(false)}
          className="rounded-lg p-1 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-400 text-xl leading-none">✕</span>
        </button>
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-4">
        {/* Temperature */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Temperature (°C)
          </label>
          <input
            type="number"
            step="0.1"
            min="-10"
            max="50"
            value={manualTemp}
            onChange={(e) => setManualTemp(parseFloat(e.target.value))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            required
          />
        </div>

        {/* Humidity */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Relative Humidity (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={manualHumidity}
            onChange={(e) => setManualHumidity(parseFloat(e.target.value))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            required
          />
        </div>

        {/* Timestamp (optional) — hidden for simplicity, defaults to now */}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowManualForm(false)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmittingManual}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmittingManual ? "Saving..." : "Save Entry"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* CSV COLUMN MAPPING MODAL */}
{showMappingModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
    <div className="w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">Map CSV Columns</h2>
        <button
          type="button"
          onClick={() => setShowMappingModal(false)}
          className="rounded-lg p-1 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-400 text-xl leading-none">✕</span>
        </button>
      </div>

      {/* File info */}
      <p className="text-xs text-zinc-400 mb-4">
        File: <span className="text-zinc-200 font-medium">{csvFile?.name}</span>
      </p>

      {/* Column mapping grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Timestamp *
          </label>
          <select
            value={csvMapping.timestampCol}
            onChange={(e) => setCsvMapping({ ...csvMapping, timestampCol: e.target.value })}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          >
            <option value="">-- Select column --</option>
            {csvHeaders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Temperature *
          </label>
          <select
            value={csvMapping.temperatureCol}
            onChange={(e) => setCsvMapping({ ...csvMapping, temperatureCol: e.target.value })}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          >
            <option value="">-- Select column --</option>
            {csvHeaders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Humidity *
          </label>
          <select
            value={csvMapping.humidityCol}
            onChange={(e) => setCsvMapping({ ...csvMapping, humidityCol: e.target.value })}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          >
            <option value="">-- Select column --</option>
            {csvHeaders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Room ID (optional)
          </label>
          <select
            value={csvMapping.roomIdCol}
            onChange={(e) => setCsvMapping({ ...csvMapping, roomIdCol: e.target.value })}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          >
            <option value="">-- None --</option>
            {csvHeaders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            Zone ID (optional)
          </label>
          <select
            value={csvMapping.zoneIdCol}
            onChange={(e) => setCsvMapping({ ...csvMapping, zoneIdCol: e.target.value })}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          >
            <option value="">-- None --</option>
            {csvHeaders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview table */}
      {csvPreview.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-400 mb-2">Preview (first {csvPreview.length} rows)</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-950">
                <tr>
                  {csvHeaders.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-zinc-400 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((row, idx) => (
                  <tr key={idx} className="border-t border-zinc-800">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-2 text-zinc-200 truncate max-w-[120px]">
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
      <div className="flex gap-3 pt-2 border-t border-zinc-800 mt-2">
        <button
          type="button"
          onClick={() => setShowMappingModal(false)}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
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
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {csvImporting ? "Importing..." : "Import Data"}
        </button>
      </div>
    </div>
  </div>
)}
    </AppShell>
  );
}

// PREMIUM LOCALIZED NUMBER FIELD COMPONENT
type DarkNumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function DarkNumberField({ label, value, onChange }: DarkNumberFieldProps) {
  return (
    <label className="grid gap-1 text-xs font-bold text-zinc-400 tracking-wide">
      {label}
      <input
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        min={0}
        step="0.05"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
