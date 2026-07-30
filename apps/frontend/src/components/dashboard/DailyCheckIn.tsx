"use client";
import React, { useState, useTransition, useMemo } from "react";
import { recordDailyCheckInLog, DailyCheckInFormData } from "@/app/actions/check-in";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Mic,
  MicOff,
  Camera,
  Scale,
  ThermometerSun,
  Droplet,
  Check,
  Loader2,
  Wind,
  Layers,
  Sparkles,
} from "lucide-react";
import { CSVImportModal } from "@/components/CSVImportModal";
import { addManualClimateAndWeight } from "@/app/actions/loggingreadings";
type TrainingEvent = DailyCheckInFormData["trainingEvent"];
export interface PlantOption {
  id: string;
  name: string;
  roomId?: string;
}
export interface RoomOption {
  id: string;
  name: string;
}
interface DailyCheckInProps {
  rooms?: RoomOption[];
  plants?: PlantOption[];
}
const TRAINING_EVENTS: TrainingEvent[] = [
  "None",
  "Top",
  "Defoliate",
  "LST",
  "Flip",
  "Harvest",
];
// Helper: Calculate Vapor Pressure Deficit (VPD) in kPa
function calculateVPD(tempF: number, rh: number): number | null {
  if (isNaN(tempF) || isNaN(rh) || rh < 0 || rh > 100) return null;
  const tempC = (tempF - 32) * (5 / 9);
  const vpsat = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpact = vpsat * (rh / 100);
  const vpd = vpsat - vpact;
  return Math.max(0, parseFloat(vpd.toFixed(2)));
}
interface PlantEntryState {
  weight: number | "";
  watered: boolean;
  fed: boolean;
  trainingEvent: TrainingEvent;
  notes: string;
  photo: File | null;
  audioBlob: Blob | null;
  isRecording: boolean;
}
export function DailyCheckIn({
  rooms = [
    { id: "room-1", name: "Flower Tent 1" },
    { id: "room-2", name: "Veg Room" },
  ],
  plants = [],
}: DailyCheckInProps) {
  const router = useRouter();
  // 1. Room State
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    rooms[0]?.id || ""
  );
  // 2. Room Telemetry State
  const [temp, setTemp] = useState<string>("");
  const [rh, setRh] = useState<string>("");
  const [isCsvSynced, setIsCsvSynced] = useState<boolean>(false);
  // Calculate live VPD
  const vpdValue = useMemo(() => {
    const t = parseFloat(temp);
    const r = parseFloat(rh);
    return calculateVPD(t, r);
  }, [temp, rh]);
  // Filter plants for selected room
  const roomPlants = useMemo(() => {
    return plants.filter(
      (p) => !p.roomId || p.roomId === selectedRoomId || selectedRoomId === ""
    );
  }, [plants, selectedRoomId]);
  // 3. Dynamic Card State per Plant
  const [plantStates, setPlantStates] = useState<Record<string, PlantEntryState>>({});
  const getPlantState = (plantId: string): PlantEntryState => {
    return (
      plantStates[plantId] || {
        weight: "",
        watered: false,
        fed: false,
        trainingEvent: "None",
        notes: "",
        photo: null,
        audioBlob: null,
        isRecording: false,
      }
    );
  };
  const updatePlantState = (
    plantId: string,
    updates: Partial<PlantEntryState>
  ) => {
    setPlantStates((prev) => ({
      ...prev,
      [plantId]: {
        ...getPlantState(plantId),
        ...updates,
      },
    }));
  };
  // UI & Action States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [csvReadingTime, setCsvReadingTime] = useState<string | null>(null);
  // CSV Autofill Handler for Telemetry
  const handleCsvSuccess = (parsedData: any[]) => {
    if (parsedData.length > 0) {
      const latest = parsedData[parsedData.length - 1];
      let imported = false;
      const tempVal = latest.temp ?? latest.temperature;
      const rhVal = latest.rh ?? latest.humidity;
      if (tempVal !== undefined && tempVal !== null && tempVal !== "") {
        setTemp(String(tempVal));
        imported = true;
      }
      if (rhVal !== undefined && rhVal !== null && rhVal !== "") {
        setRh(String(rhVal));
        imported = true;
      }
      if (latest.timestamp) {
      setCsvReadingTime(latest.timestamp);
      }
      if (imported) setIsCsvSynced(true);
    }
  };
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  setFeedback(null);
  startTransition(async () => {
    try {
      // 1. Save room-level climate telemetry, if entered
      const tempF = parseFloat(temp);
      const rhVal = parseFloat(rh);
      const hasClimate = !isNaN(tempF) && !isNaN(rhVal);
      if (hasClimate) {
        const tempC = ((tempF - 32) * 5) / 9;
        await addManualClimateAndWeight({
          temperature: tempC,
          humidity: rhVal,
          wetWeight: 18.4,
          dryTarget: 13.2,
        });
      }
      // 2. Save plant check-in logs ONLY for plants that actually have data entered
      let plantLogsRecorded = 0;
      for (const plant of roomPlants) {
        const st = getPlantState(plant.id);
        
        // Check if user filled out ANY plant-specific field
        const hasWeight = typeof st.weight === "number" && st.weight > 0;
        const hasNotes = Boolean(st.notes?.trim());
        const hasActions = st.watered || st.fed || st.trainingEvent;
        // Skip plants that were left untouched
        if (!hasWeight && !hasNotes && !hasActions) continue;
        const payload: DailyCheckInFormData = {
          plantId: plant.id,
          weight: st.weight === "" || st.weight === undefined ? undefined: st.weight,
          watered: st.watered,
          fed: st.fed,
          trainingEvent: st.trainingEvent,
          notes: st.notes.trim() || undefined,
        };
        const result = await recordDailyCheckInLog(payload);
        if (!result.success) {
          throw new Error(result.error || `Failed log for ${plant.name}`);
        }
        plantLogsRecorded++;
      }
      // Safeguard: Ensure at least climate data OR at least one plant entry was submitted
      if (!hasClimate && plantLogsRecorded === 0) {
        setFeedback({
          type: "error",
          message: "Please enter room climate metrics or fill out at least one plant entry.",
        });
        return;
      }
      setFeedback({
        type: "success",
        message: "Check-in logged successfully! Redirecting...",
      });
      setPlantStates({});
      setTemp("");
      setRh("");
      setIsCsvSynced(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to submit check-in logs.",
      });
    }
  });
};
  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl max-w-2xl mx-auto space-y-6">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-canopy dark:text-emerald-400">
              Daily Operations Log
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Record room telemetry and plant batch factors
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-mist dark:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-canopy dark:text-emerald-400 hover:bg-canopy/10 dark:hover:bg-emerald-500/10 border border-canopy/20 dark:border-emerald-500/20 transition-all shrink-0"
          >
            <FileSpreadsheet className="size-4" />
            <span>Import CSV</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Room Selector */}
          <div>
            <label
              htmlFor="room-selector"
              className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5"
            >
              <Layers className="size-4 text-canopy dark:text-emerald-400" />
              Room
            </label>
            <select
              id="room-selector"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
            >
              {rooms.length === 0 ? (
                <option value="" disabled>
                  No rooms defined
                </option>
              ) : (
                rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))
              )}
            </select>
          </div>
          {/* Section 2: Room Environmental Telemetry & Live VPD (With CSV Visual Feedback) */}
          <div
            className={`border rounded-xl p-4 transition-all ${
              isCsvSynced
                ? "bg-emerald-500/5 border-emerald-500/40 dark:border-emerald-500/50 shadow-sm"
                : "bg-mist/20 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/60"
            }`}
          >
            {/* CSV Sync Badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Room Telemetry
              </span>
              {isCsvSynced && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 animate-fade-in">
                  <Sparkles className="size-3" />
                  {csvReadingTime ? `Synced — ${csvReadingTime}` : "CSV Synced"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <ThermometerSun className="size-4 text-clay dark:text-orange-400" />
                  Temp (°F)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="75.5"
                  value={temp}
                  onChange={(e) => {
                    setTemp(e.target.value);
                    setIsCsvSynced(false);
                  }}
                  className="w-full p-2 bg-white dark:bg-zinc-900 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Droplet className="size-4 text-blue-500" />
                  RH (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="60.0"
                  value={rh}
                  onChange={(e) => {
                    setRh(e.target.value);
                    setIsCsvSynced(false);
                  }}
                  className="w-full p-2 bg-white dark:bg-zinc-900 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
                />
              </div>
              {/* VPD Metric Display */}
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Wind className="size-3 text-canopy dark:text-emerald-400" />
                  VPD Display
                </span>
                <span className="text-lg font-black text-canopy dark:text-emerald-400 mt-0.5">
                  {vpdValue !== null ? `${vpdValue} kPa` : "--"}
                </span>
              </div>
            </div>
          </div>
          {/* Section 3: Plant Cards Batch List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                Plants in Room ({roomPlants.length})
              </h3>
              <span className="text-xs text-zinc-400">
                Enter plant specific factors
              </span>
            </div>
            {roomPlants.length === 0 ? (
              <p className="text-xs text-zinc-400 italic text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                No active plants found for this room.
              </p>
            ) : (
              roomPlants.map((plant) => {
                const st = getPlantState(plant.id);
                return (
                  <div
                    key={plant.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white dark:bg-zinc-900/80 shadow-sm space-y-3 transition-all hover:border-canopy/40 dark:hover:border-emerald-500/40"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <span className="text-sm font-bold text-graphite dark:text-zinc-100">
                        {plant.name}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        ID: {plant.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Scale className="size-3.5 text-canopy dark:text-emerald-400" />
                          Weight (lbs)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 14.2"
                          value={st.weight}
                          onChange={(e) =>
                            updatePlantState(plant.id, {
                              weight:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          className="w-full p-2 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Watered
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlantState(plant.id, {
                                watered: !st.watered,
                              })
                            }
                            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              st.watered
                                ? "bg-canopy dark:bg-emerald-600 text-white"
                                : "bg-mist dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {st.watered ? "Yes" : "No"}
                          </button>
                        </div>
                        <div>
                          <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Fed
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlantState(plant.id, { fed: !st.fed })
                            }
                            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              st.fed
                                ? "bg-canopy dark:bg-emerald-600 text-white"
                                : "bg-mist dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {st.fed ? "Yes" : "No"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Training Event
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {TRAINING_EVENTS.map((event) => (
                          <button
                            key={event}
                            type="button"
                            onClick={() =>
                              updatePlantState(plant.id, {
                                trainingEvent: event,
                              })
                            }
                            className={`py-1 px-2.5 rounded-full text-[10px] font-bold transition-colors ${
                              st.trainingEvent === event
                                ? "bg-canopy dark:bg-emerald-600 text-white"
                                : "bg-mist dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            {event}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Plant notes / observations..."
                          maxLength={100}
                          value={st.notes}
                          onChange={(e) =>
                            updatePlantState(plant.id, { notes: e.target.value })
                          }
                          className="w-full p-2 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updatePlantState(plant.id, {
                              isRecording: !st.isRecording,
                            })
                          }
                          className={`p-2 rounded-lg border transition-all ${
                            st.isRecording
                              ? "bg-red-500/10 border-red-500 text-red-500 animate-pulse"
                              : "border-zinc-200 dark:border-zinc-700 bg-mist/30 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}
                          title="Record voice note"
                        >
                          {st.isRecording ? (
                            <MicOff className="size-3.5" />
                          ) : (
                            <Mic className="size-3.5" />
                          )}
                        </button>
                        <label
                          className="flex-1 flex items-center justify-center p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-mist/30 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer hover:border-canopy dark:hover:border-emerald-500"
                          title="Attach photo"
                        >
                          <Camera className="size-3.5 mr-1" />
                          <span className="text-[10px] font-bold truncate max-w-[60px]">
                            {st.photo ? st.photo.name : "Photo"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updatePlantState(plant.id, {
                                photo: e.target.files?.[0] || null,
                              })
                            }
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {feedback && (
            <p
              className={`text-center text-xs font-bold ${
                feedback.type === "success"
                  ? "text-emerald-500"
                  : "text-rose-500"
              }`}
            >
              {feedback.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending || roomPlants.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-canopy dark:bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-canopy/90 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span>Saving Batch Check-In...</span>
              </>
            ) : (
              <>
                <Check className="size-5" />
                <span>Submit Batch Check-In</span>
              </>
            )}
          </button>
        </form>
      </div>
      <CSVImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImportSuccess={handleCsvSuccess}
      />
    </>
  );
}