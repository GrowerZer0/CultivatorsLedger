"use client";

import React, { useState, useTransition } from "react";
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
} from "lucide-react";
import { CSVImportModal } from "@/components/CSVImportModal";

type TrainingEvent = DailyCheckInFormData["trainingEvent"];

interface PlantOption {
  id: string;
  name: string;
}

interface DailyCheckInProps {
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

export function DailyCheckIn({ plants = [] }: DailyCheckInProps) {
  const router = useRouter();

  // Existing Form State
  const [selectedPlantId, setSelectedPlantId] = useState<string>(
    plants[0]?.id || ""
  );
  const [weight, setWeight] = useState<number | "">("");
  const [watered, setWatered] = useState<boolean>(false);
  const [fed, setFed] = useState<boolean>(false);
  const [trainingEvent, setTrainingEvent] = useState<TrainingEvent>("None");
  const [notes, setNotes] = useState<string>("");

  // New Environment Inputs
  const [temp, setTemp] = useState<string>("");
  const [rh, setRh] = useState<string>("");

  // New Media Inputs
  const [photo, setPhoto] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // UI & Action States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Toggle voice recording
  const toggleRecording = () => {
    // MediaRecorder logic hooks in here
    setIsRecording(!isRecording);
  };

  // CSV autofill handler
  const handleCsvSuccess = (parsedData: any[]) => {
    if (parsedData.length > 0) {
      const latest = parsedData[parsedData.length - 1];
      if (latest.temp || latest.temperature) {
        setTemp(latest.temp || latest.temperature);
      }
      if (latest.rh || latest.humidity) {
        setRh(latest.rh || latest.humidity);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedPlantId || weight === "") {
      setFeedback({
        type: "error",
        message: "Please select a plant and enter a weight.",
      });
      return;
    }

    if (Number(weight) <= 0) {
      setFeedback({
        type: "error",
        message: "Weight must be greater than zero.",
      });
      return;
    }

    startTransition(async () => {
      const payload: DailyCheckInFormData & {
        temp?: number;
        rh?: number;
        photo?: File | null;
        audioBlob?: Blob | null;
      } = {
        plantId: selectedPlantId,
        weight: Number(weight),
        watered,
        fed,
        trainingEvent,
        notes: notes.trim() || undefined,
        temp: temp ? parseFloat(temp) : undefined,
        rh: rh ? parseFloat(rh) : undefined,
        photo,
        audioBlob,
      };

      const result = await recordDailyCheckInLog(payload);

      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error || "Failed to submit check-in.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: "Check-in logged successfully! Redirecting...",
      });

      // Reset form fields
      setWeight("");
      setTemp("");
      setRh("");
      setPhoto(null);
      setAudioBlob(null);
      setWatered(false);
      setFed(false);
      setTrainingEvent("None");
      setNotes("");

      // Navigate to operational dashboard
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl max-w-lg mx-auto">
        {/* Header with CSV Import Option */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-canopy dark:text-emerald-400">
              Daily Plant Check-In
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Log metrics, environment, weight, and voice notes
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Plant Selector */}
          <div>
            <label
              htmlFor="plant-selector"
              className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Plant / Batch
            </label>
            <select
              id="plant-selector"
              value={selectedPlantId}
              onChange={(e) => setSelectedPlantId(e.target.value)}
              className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
              required
            >
              {plants.length === 0 ? (
                <option value="" disabled>
                  No active plants available
                </option>
              ) : (
                plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Manual Temp & RH Fields */}
          <div className="grid grid-cols-2 gap-4">
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
                onChange={(e) => setTemp(e.target.value)}
                className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
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
                onChange={(e) => setRh(e.target.value)}
                className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
              />
            </div>
          </div>

          {/* Weight Input */}
          <div>
            <label
              htmlFor="weight"
              className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5"
            >
              <Scale className="size-4 text-canopy dark:text-emerald-400" />
              Current Weight (lbs)
            </label>
            <input
              type="number"
              id="weight"
              step="0.1"
              value={weight}
              onChange={(e) =>
                setWeight(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
              placeholder="e.g. 14.2"
              autoFocus
              required
            />
          </div>

          {/* Watered & Fed Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Watered?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWatered(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    watered
                      ? "bg-canopy dark:bg-emerald-600 text-white"
                      : "bg-mist dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setWatered(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    !watered
                      ? "bg-zinc-200 dark:bg-zinc-700 text-graphite dark:text-zinc-200"
                      : "bg-mist dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Fed?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFed(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    fed
                      ? "bg-canopy dark:bg-emerald-600 text-white"
                      : "bg-mist dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFed(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    !fed
                      ? "bg-zinc-200 dark:bg-zinc-700 text-graphite dark:text-zinc-200"
                      : "bg-mist dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          </div>

          {/* Training Event */}
          <div>
            <span className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Training Event
            </span>
            <div className="flex flex-wrap gap-2">
              {TRAINING_EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => setTrainingEvent(event)}
                  className={`py-1.5 px-3 rounded-full text-xs font-bold transition-colors ${
                    trainingEvent === event
                      ? "bg-canopy dark:bg-emerald-600 text-white"
                      : "bg-mist dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Note & Photo Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Mic className="size-4 text-clay dark:text-orange-400" />
                Voice Observation
              </label>
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 border text-xs font-bold transition-all ${
                  isRecording
                    ? "bg-red-500/10 border-red-500 text-red-500 animate-pulse"
                    : "border-zinc-200 dark:border-zinc-700 bg-mist/30 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-canopy dark:hover:border-emerald-500"
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="size-4" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Mic className="size-4" />
                    <span>{audioBlob ? "Record Again" : "Voice Note"}</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Camera className="size-4 text-canopy dark:text-emerald-400" />
                Diagnostic Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                className="block w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-mist file:text-canopy dark:file:bg-zinc-800 dark:file:text-emerald-400 hover:file:bg-canopy/10"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Notes
            </label>
            <input
              type="text"
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-mist/30 dark:bg-zinc-800 text-graphite dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-canopy dark:focus:ring-emerald-500 outline-none text-sm font-semibold"
              placeholder="Quick single-line observation..."
              maxLength={100}
            />
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <p
              className={`text-center text-sm font-semibold ${
                feedback.type === "success" ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {feedback.message}
            </p>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isPending || plants.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-canopy dark:bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-canopy/90 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span>Recording Check-In...</span>
              </>
            ) : (
              <>
                <Check className="size-5" />
                <span>Finish Check-In</span>
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