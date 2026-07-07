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
  Upload,
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
  YAxis,
  ReferenceArea,
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
  const [showFeeding, setShowFeeding] = useState(true);

  // --- 3. CORE INPUT CALCULATOR STATES ---
  const [containerGallons, setContainerGallons] = useState(5);
  const [wetWeight, setWetWeight] = useState(18.4);
  const [dryTargetWeight, setDryTargetWeight] = useState(13.2);
  const [currentWeight, setCurrentWeight] = useState(14.2);
  const [reservoirGallons, setReservoirGallons] = useState(1);
  const [leftoverGallons, setLeftoverGallons] = useState(0);
  const [currentEc, setCurrentEc] = useState(1.4);
  const [isSaving, setIsSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'g'>('lbs');
  const [selectedRoom, setSelectedRoom] = useState('tent_1');
  const [selectedStrain, setSelectedStrain] = useState('Blueberry Muffin');
  const [batchName, setBatchName] = useState("Blueberry Muffin #3");

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
  // Reset feeding inputs when nutrient line changes
  // (optional: we can make these defaults per schedule later)
  setReservoirGallons(40);
  setLeftoverGallons(11.5);
  setCurrentEc(1.4);
}, [activeLineId]);

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
        runoff_ec: profile.hasEcmeter ? 2.2 : 0,
        unit: weightUnit,
      });
      alert("Dry-back log successfully saved!");
      const data = await getDashboardData();
      setDbDryBackLogs(data.dryBackLogs || []);
    } catch (error) {
      console.error("Failed to commit ledger entry:", error);
    } finally {
      setIsSaving(false);
    }
  }

  const handleResetFeeding = () => {
  setReservoirGallons(1);
  setLeftoverGallons(0);
  setCurrentEc(1.4);
};

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

// --- VPD Score & Streak (gamification) ---
const vpdScoreData = useMemo(() => {
  if (!dbEnvironmentReadings || dbEnvironmentReadings.length === 0) {
    return { score: 0, streak: 0, readingsInRange: 0, totalReadings: 0 };
  }

  const targetMin = 0.8;
  const targetMax = 1.2;
  const readings = dbEnvironmentReadings;

  // Count in-range readings
  const inRangeCount = readings.filter(r => r.vpd >= targetMin && r.vpd <= targetMax).length;
  const score = readings.length > 0 ? (inRangeCount / readings.length) * 100 : 0;

  // Streak: count consecutive in-range readings from the most recent backwards
  let streak = 0;
  for (let i = readings.length - 1; i >= 0; i--) {
    if (readings[i].vpd >= targetMin && readings[i].vpd <= targetMax) {
      streak++;
    } else {
      break;
    }
  }

  return {
    score,
    streak,
    readingsInRange: inRangeCount,
    totalReadings: readings.length,
  };
}, [dbEnvironmentReadings]);

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
        <div className="flex h-[75vh] items-center justify-center bg-white dark:bg-[#0B0F19] text-sm font-semibold text-gray-500 dark:text-zinc-400 tracking-wide animate-pulse">
          Initializing secure telemetry pipelines and core ledger nodes...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-gray-900 dark:text-zinc-100 p-1 lg:p-4 font-sans selection:bg-emerald-500/30">
        
        {/* Demo Mode Banner */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="text-lg">🧪</span>
              Demo Mode — Explore the dashboard with sample data. No installation required.
          </span>
          <a
            href="https://github.com/growerzer0/cultivatorsledger"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            GitHub Repo →
          </a>
        </div>
      )}

        {/* TOP COMMAND NAVIGATION BAR */}
        <header className="mb-6 flex flex-col gap-4 border-b border-gray-200 dark:border-zinc-800 pb-5">
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-2">
        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">
          Production Environment
        </span>
      </div>
      <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white mt-1">My Grow Room</h1>
      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Real-time telemetry aggregation and structural crop-steering optimization arrays.</p>
    </div>

    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={() => setShowManualForm(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-gray-900 dark:text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
      >
        <Plus className="size-4" />
        Log Manual Reading
      </button>
      <button
        type="button"
        onClick={() => document.getElementById("csv-upload")?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-zinc-700 hover:border-zinc-500 px-4 py-2 text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all cursor-pointer"
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
  </div>

  {/* Room & Strain Selectors + Batch Input */}
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap border-t border-gray-200 dark:border-zinc-800 pt-4 mt-1">
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Room:</span>
      <select
        value={selectedRoom}
        onChange={(e) => setSelectedRoom(e.target.value)}
        className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
      >
        <option value="tent_1">Tent 1</option>
        <option value="tent_2">Tent 2</option>
        <option value="room_a">Room A</option>
        <option value="room_b">Room B</option>
      </select>
    </div>

    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Strain:</span>
      <select
        value={selectedStrain}
        onChange={(e) => setSelectedStrain(e.target.value)}
        className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
      >
        <option value="Blueberry Muffin">Blueberry Muffin</option>
        <option value="Gelato">Gelato</option>
        <option value="Pineapple Express">Pineapple Express</option>
        <option value="OG Kush">OG Kush</option>
      </select>
    </div>

    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Batch:</span>
      <input
        type="text"
        placeholder="e.g. BM #3"
        className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500 w-32"
        value={batchName}
        onChange={(e) => setBatchName(e.target.value)}
      />
    </div>

    {/* Sensor Mode Toggle - moved here for consistency */}
    <div className="inline-flex rounded-xl bg-gray-50 dark:bg-zinc-950 p-1 border border-gray-200 dark:border-zinc-800 ml-auto">
      <button
        type="button"
        onClick={() => setIsSensorDriven(false)}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          !isSensorDriven
            ? "bg-emerald-600 text-gray-900 dark:text-white shadow-md ring-1 ring-zinc-700/50"
            : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300"
        }`}
      >
        <Keyboard className="size-3.5" /> Manual
      </button>
      <button
        type="button"
        onClick={() => setIsSensorDriven(true)}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          isSensorDriven
            ? "bg-emerald-600 text-gray-900 dark:text-white shadow-md shadow-emerald-900/20 ring-1 ring-emerald-500/30"
            : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300"
        }`}
      >
        <Cpu className="size-3.5" /> Hardware
      </button>
    </div>
  </div>
</header>

        {/* INCIDENT REPORT & FAULT MONITOR LINE */}
{dynamicGrowAlerts.map((alert, idx) => (
  <div 
    key={idx}
    className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-3 shadow-sm transition-all duration-300 ${
      alert.type === "critical" 
        ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60 ring-1 ring-red-500/10" 
      : alert.type === "danger" 
        ? "bg-red-50/80 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-950/50" 
      : alert.type === "warning" 
        ? "bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40" 
      : alert.type === "success" 
        ? "bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40" 
      : "bg-gray-50 dark:bg-zinc-900/50 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800"
    }`}
  >
    {alert.type === "critical" ? (
      <ShieldAlert className="size-4.5 shrink-0 text-red-500 dark:text-red-400 animate-pulse mt-0.5" />
    ) : (
      <AlertTriangle className={`size-4.5 shrink-0 mt-0.5 ${
        alert.type === "danger" || alert.type === "warning" ? "text-amber-500 dark:text-amber-400" : "text-emerald-500 dark:text-emerald-400"
      }`} />
    )}
    <div className="flex-1">
      {alert.type === "critical" && <span className="font-extrabold text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 block mb-0.5">Automated Facility Intervention</span>}
      <span className="leading-relaxed">{alert.text}</span>
    </div>
  </div>
))}

{/* 📊 PRIMARY METRICS */}
<div className="grid gap-4 md:grid-cols-2 mb-6">
  {/* Dry-Back Progress Card */}
  {profile.hasScales && (
    <div className="bg-white/90 dark:bg-white dark:bg-zinc-900/90 border border-gray-200/80 dark:border-gray-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-5">
      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner shrink-0">
        <Weight className="size-7" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 dark:text-zinc-500 block">Dry-Back Progress</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-gray-900 dark:text-white">{activeDryBack.dryBackPercent.toFixed(0)}%</span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            ({activeDryBack.poundsUntilIrrigation.toFixed(1)} {weightUnit} to limit)
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, activeDryBack.dryBackPercent)}%` }}
          />
        </div>
      </div>
    </div>
  )}

  {/* Environment Card */}
  {profile.hasClimateHub && (
    <div className="bg-white/90 dark:bg-white dark:bg-zinc-900/90 border border-gray-200/80 dark:border-gray-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-5">
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner shrink-0">
        <ThermometerSun className="size-7" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 dark:text-zinc-500 block">Room Climate</span>
        {dbEnvironmentReadings.length > 0 ? (
          <>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-black text-gray-900 dark:text-white">
                {(dbEnvironmentReadings.at(-1)?.temperatureF ?? 0).toFixed(1)}°F
              </span>
              <span className="text-sm text-gray-500 dark:text-zinc-400">
                {(dbEnvironmentReadings.at(-1)?.humidity ?? 0).toFixed(0)}% RH
              </span>
              <span className={`text-sm font-bold ${
                (dbEnvironmentReadings.at(-1)?.vpd ?? 0) > 1.2 ? 'text-amber-400' :
                (dbEnvironmentReadings.at(-1)?.vpd ?? 0) < 0.8 ? 'text-blue-400' :
                'text-emerald-400'
              }`}>
                {(dbEnvironmentReadings.at(-1)?.vpd ?? 0).toFixed(2)} VPD
              </span>
              {/* VPD Score & Streak */}
<div className="flex items-center gap-4 mt-2">
  {/* Score ring */}
  <div className="flex items-center gap-2">
    <div className="relative size-10">
      <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className="stroke-gray-200 dark:stroke-zinc-700"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className={
            vpdScoreData.score > 80
              ? 'stroke-emerald-500'
              : vpdScoreData.score > 50
              ? 'stroke-yellow-400'
              : 'stroke-red-500'
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
    <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
      VPD Score
    </span>
  </div>

  {/* Streak */}
  <div className="flex items-center gap-2">
    <span className="text-lg">🔥</span>
    <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
      {vpdScoreData.streak} hr streak
    </span>
  </div>
</div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                {selectedRoom} • {selectedStrain} • Batch: {batchName}
              </span>
            </div>
          </>
        ) : (
          <span className="text-sm text-gray-400 dark:text-zinc-500">Waiting for data...</span>
        )}
      </div>
    </div>
  )}
</div>

           
{/* FEEDING CALCULATOR (Collapsible) */}
<div className="mt-6">
  <button
    type="button"
    onClick={() => setShowFeeding(!showFeeding)}
    className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-white transition-colors cursor-pointer"
  >
    {showFeeding ? '▼' : '▶'} Feeding Calculator
    <span className="text-[10px] text-zinc-600 font-normal">
      {showFeeding ? 'click to close' : 'click to open'}
    </span>
  </button>

  {showFeeding && (
    <div className="mt-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl">
      {/* Header with Brand Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Droplets className="size-4 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dynamic Reservoir Dosing</h3>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">Top off system reservoirs while maintaining targeted chemical balances.</p>
          </div>
        </div>

        {/* Brand Schedule Selector */}
        <select
          value={activeLineId}
          onChange={(e) => setActiveLineId(e.target.value)}
          className="text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 p-2 outline-none text-gray-800 dark:text-zinc-200 cursor-pointer focus:border-cyan-500 transition-all shadow-inner"
        >
          {combinedSchedules.map((s) => (
            <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
              {s.brand} {s.stage ? `(${s.stage})` : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
  <button
    type="button"
    onClick={handleResetFeeding}
    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-300 dark:hover:text-zinc-300 transition-colors"
  >
    Reset to Defaults
  </button>
</div>
      </div>


      {/* Inputs */}
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <DarkNumberField label="Tank Capacity (Gal)" value={reservoirGallons} onChange={setReservoirGallons} />
        <DarkNumberField label="Current Backlog Vol (Gal)" value={leftoverGallons} onChange={setLeftoverGallons} />
        <div className="grid gap-1">
          <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tracking-wide">Current Solution EC</span>
          <input
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-40 disabled:bg-white dark:bg-zinc-900 transition-all"
            type="number"
            step="0.05"
            value={effectiveEc}
            onChange={(e) => setCurrentEc(Number(e.target.value))}
            disabled={isSensorDriven}
          />
          {isSensorDriven && <span className="text-[9px] text-emerald-400 font-bold tracking-wider mt-0.5">LOCKED TO SENSOR</span>}
        </div>
      </div>

      {/* Nutrient Breakdown */}
<div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
  {activeSchedule.doses.map((dose: NutrientDose, index: number) => (
    <div
      key={`${dose.product}-${index}`}
      className={`grid gap-3 grid-cols-[1fr_80px_90px] items-center rounded-lg px-3 py-2 text-xs ${
        index % 2 === 0
          ? 'bg-gray-50/50 dark:bg-zinc-800/30'
          : 'bg-transparent'
      }`}
    >
      <div className="font-medium text-gray-700 dark:text-zinc-300 truncate">
        {dose.product}
      </div>
      <div className="text-center font-mono text-gray-500 dark:text-zinc-400">
        {dose.mlPerGallon} mL/g
      </div>
      <div className={`text-center font-black font-mono transition-all ${
        reservoirDelta.isCriticalClamp
          ? 'text-red-400'
          : 'text-orange-400'
      }`}>
        {reservoirDelta.nutrientsToAdd[index]?.totalMl ?? 0} mL
      </div>
    </div>
  ))}
</div>

<p className="mt-3 text-[10px] text-gray-400 dark:text-zinc-400 italic">
  Adjust ml/gallon values in <span className="font-medium">Settings → Nutrient Feed Library</span>
</p>

      {/* Footer: Dynamic Output Targets */}
      <div className={`mt-4 rounded-xl border p-4 transition-all ${
        reservoirDelta.isCriticalClamp ? "bg-red-950/20 border-red-900/60" : "border-gray-200 dark:border-zinc-800 bg-gray-50/30 dark:bg-gray-50 dark:bg-zinc-950/30"
      }`}>
        <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${reservoirDelta.isCriticalClamp ? "text-red-400" : "text-emerald-400"}`}>
          <Sprout className="size-4" />
          Dynamic Output Targets • {activeSchedule.brand} ({activeSchedule.stage})
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-zinc-300 font-medium">
          {effectiveEc === 0 ? (
            <>
              <span className="text-gray-900 dark:text-white font-bold">Standard Delivery:</span> Mix base concentrates into fresh top‑off water to achieve <span className="font-extrabold text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-950 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-800">{activeSchedule.targetEc} EC</span>.
            </>
          ) : (
            <>
              Target base blueprint: <span className="text-gray-900 dark:text-white font-bold">{activeSchedule.targetEc} EC</span>. 
              Accounting for residual solution (<span className="text-gray-900 dark:text-white font-mono font-bold">{effectiveEc} EC</span>), 
              blend top‑off to <span className={`font-black font-mono bg-gray-50 dark:bg-zinc-950 px-1.5 py-0.5 rounded border ${reservoirDelta.isCriticalClamp ? 'text-red-400 border-red-900' : 'text-orange-400 border-gray-200 dark:border-zinc-800'}`}>{reservoirDelta.adjustedTopOffEc} EC</span>.
            </>
          )}
        </p>
      </div>
    </div>
  )}
</div>

{/* 🎛️ TWO-COLUMN OPERATIONAL CONTROL GRID */}
<div className="grid gap-6 xl:grid-cols-2 mb-6">
  
  {/* LEFT COLUMN: Dry-Back Analytics (Inputs + Chart) */}
  <div className="space-y-4">
        {/* Precision Dry-Back Analytics */}
    {profile.hasScales && (
  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl">
    <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-zinc-800 pb-3">
      <Sliders className="size-4 text-emerald-400" />
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Precision Dry-Back Analytics</h3>
        <p className="text-[11px] text-gray-500 dark:text-zinc-400">Calibrate volumetric container dry targets down to single grams.</p>
      </div>
    </div>

    {/* Unit Toggle */}
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Unit:</span>
      <button
        type="button"
        onClick={() => setWeightUnit('lbs')}
        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
          weightUnit === 'lbs' ? 'bg-emerald-600 text-gray-900 dark:text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300'
        }`}
      >
        lbs
      </button>
      <button
        type="button"
        onClick={() => setWeightUnit('g')}
        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
          weightUnit === 'g' ? 'bg-emerald-600 text-gray-900 dark:text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300'
        }`}
      >
        g
      </button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <DarkNumberField
        label={`Current Container Weight (${weightUnit})`}
        value={currentWeight}
        onChange={setCurrentWeight}
      />
      <DarkNumberField
        label={`Target Dry Weight (${weightUnit})`}
        value={dryTargetWeight}
        onChange={setDryTargetWeight}
      />
      <DarkNumberField
        label={`Target Saturated Weight (${weightUnit})`}
        value={wetWeight}
        onChange={setWetWeight}
      />
    </div>

<div className={`mt-5 rounded-xl p-4 border transition-all ${
  activeDryBack.isClamped 
    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50" 
    : "bg-gray-50 dark:bg-zinc-950/60 border-gray-200 dark:border-zinc-800"
}`}>
  <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase ${
    activeDryBack.isClamped 
      ? "text-amber-700 dark:text-amber-400" 
      : "text-emerald-700 dark:text-emerald-400"
  }`}>
    <Activity className="size-3.5" />
    Watering Window Forecasting Matrix
  </div>
  <p className={`mt-2 text-xs leading-relaxed ${
    activeDryBack.isClamped 
      ? "text-amber-800 dark:text-amber-300" 
      : "text-gray-700 dark:text-zinc-300"
  }`}>
    {activeDryBack.isClamped ? (
      "Calculations suspended due to telemetry boundary violation error. Re-verify input configurations above."
    ) : (
      <>Current root media is <span className="font-bold text-gray-900 dark:text-white">{activeDryBack.dryBackPercent.toFixed(1)}%</span> through dry-back cycle target. Estimated irrigation trigger in <span className="font-bold text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30">{activeDryBack.estimatedHoursUntilWater} hours</span>.</>
    )}
  </p>
</div>

    <button
      type="button"
      disabled={isSaving || activeDryBack.isClamped}
      onClick={handleSaveLog}
      className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-gray-900 dark:text-white text-xs px-4 py-3 shadow-lg shadow-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
    >
      {isSaving ? "Saving..." : "Log Dry-Back Reading"}
    </button>
  </div>
)}
  </div>

    {/* Dry-Back Chart */}
    {profile.hasScales && (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Dry-Back Trend</h3>
          <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">{dbDryBackLogs.length} points</span>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dryBackChartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
              <CartesianGrid stroke="#1F2937" className="opacity-40" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="var(--axis-color)" fontSize={10} tickLine={false} />
<YAxis stroke="#4B5563" fontSize={10} tickLine={false} label={{
  value: `Weight (${weightUnit})`,
  angle: -90,
  position: 'insideLeft',
  fill: '#9CA3AF',
  fontSize: 10,
}} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
              <Line type="monotone" dataKey="weight" name="Weight" stroke="#10B981" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </div>

  {/* RIGHT COLUMN: VPD Chart */}
  {profile.hasClimateHub && (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Atmospheric VPD</h3>
        </div>
        <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">Continuous feed</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart key={dbEnvironmentReadings.length} data={dbEnvironmentReadings} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
<XAxis dataKey="recordedAt" stroke="var(--axis-color)" fontSize={10} tickLine={false} />
 <YAxis stroke="#4B5563" fontSize={10} tickLine={false} label={{
  value: 'VPD (kPa)',
  angle: -90,
  position: 'insideLeft',
  fill: '#9CA3AF',
  fontSize: 10,
}} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} />
            <ReferenceArea
              y1={0.8}
              y2={1.2}
              fill="#10B981"
              fillOpacity={0.1}
              stroke="#10B981"
              strokeOpacity={0.2}
              strokeDasharray="3 3"
              label={{
                value: "Target",
                position: "top",
                fill: "#10B981",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
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

        {/* COMPREHENSIVE CONTEXT INTERACTIVE DATA DOCK PANEL */}
        <AIChatWidget
          activeDryBack={activeDryBack}
          reservoirDelta={reservoirDelta}
          latestEnvironment={dbEnvironmentReadings.at(-1)}
          latestRunoffEc={dbDryBackLogs.at(-1)?.runoff_ec}
          activeSchedule={activeSchedule}
          leftoverGallons={leftoverGallons}
        />

      {/* MANUAL ENTRY MODAL */}
{showManualForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-2xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Manual Climate Log</h2>
        <button
          type="button"
          onClick={() => setShowManualForm(false)}
          className="rounded-lg p-1 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-gray-500 dark:text-zinc-400 text-xl leading-none">✕</span>
        </button>
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-4">
        {/* Temperature */}
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Temperature (°C)
          </label>
          <input
            type="number"
            step="0.1"
            min="-10"
            max="50"
            value={manualTemp}
            onChange={(e) => setManualTemp(parseFloat(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-4 py-3 text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            required
          />
        </div>

        {/* Humidity */}
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Relative Humidity (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={manualHumidity}
            onChange={(e) => setManualHumidity(parseFloat(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-4 py-3 text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            required
          />
        </div>

        {/* Timestamp (optional) — hidden for simplicity, defaults to now */}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowManualForm(false)}
            className="flex-1 rounded-xl border border-gray-300 dark:border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmittingManual}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            {csvHeaders.map((h) => (
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
            {csvHeaders.map((h) => (
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
            {csvHeaders.map((h) => (
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
            {csvHeaders.map((h) => (
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
            {csvHeaders.map((h) => (
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
                  {csvHeaders.map((h) => (
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
  </AppShell>
  );
}

{/* 🧪 Demo Mode CTA */}
{process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
  <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
    <h3 className="text-lg font-bold text-white">Ready to run it on your own hardware?</h3>
    <p className="mt-1 text-sm text-zinc-400">
      Deploy with Docker Compose in minutes.
    </p>
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
      <code className="rounded-lg bg-zinc-950 px-4 py-2 text-sm text-emerald-400 font-mono">
        git clone https://github.com/growerzer0/cultivatorsledger.git
      </code>
      <a
        href="https://github.com/growerzer0/cultivatorsledger"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
      >
        View on GitHub →
      </a>
    </div>
    
    <div className="mt-4 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
      What would you change?{' '}
      <a
        href="https://github.com/growerzer0/cultivatorsledger/issues"
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        Open an issue on GitHub
      </a>
      {' or reply in the comments.'}
    </div>
  </div>
)}

// PREMIUM LOCALIZED NUMBER FIELD COMPONENT 
type DarkNumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function DarkNumberField({ label, value, onChange }: DarkNumberFieldProps) {
  return (
    <label className="grid gap-1 text-xs font-bold text-gray-500 dark:text-zinc-400 tracking-wide">
      {label}
      <input
        className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        min={0}
        step="0.05"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
    );
}