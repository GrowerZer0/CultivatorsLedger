"use client";

import React, { useState, useTransition } from "react";
import { recordDailyCheckInLog, DailyCheckInFormData } from "@/app/actions/check-in";
import { useRouter } from 'next/navigation'; 

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
  const [selectedPlantId, setSelectedPlantId] = useState<string>(
    plants[0]?.id || ""
  );
  const [weight, setWeight] = useState<number | "">("");
  const [watered, setWatered] = useState<boolean>(false);
  const [fed, setFed] = useState<boolean>(false);
  const [trainingEvent, setTrainingEvent] = useState<TrainingEvent>("None");
  const [notes, setNotes] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
      const payload: DailyCheckInFormData = {
        plantId: selectedPlantId,
        weight: Number(weight),
        watered,
        fed,
        trainingEvent,
        notes: notes.trim() || undefined,
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
      setWatered(false);
      setFed(false);
      setTrainingEvent("None");
      setNotes("");

      // Navigate to the operational dashboard
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="bg-white/90 dark:bg-zinc-900/90 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xl max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-cyan-400 mb-6 text-center">
        Daily Plant Check-In
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plant Selector */}
        <div>
          <label
            htmlFor="plant-selector"
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            Plant / Batch
          </label>
          <select
            id="plant-selector"
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="w-full p-2.5 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
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

        {/* Weight Input */}
        <div>
          <label
            htmlFor="weight"
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
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
            className="w-full p-2.5 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="e.g. 14.2"
            autoFocus
            required
          />
        </div>

        {/* Watered & Fed Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-zinc-300 mb-1">
              Watered?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWatered(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  watered
                    ? "bg-cyan-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWatered(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !watered
                    ? "bg-zinc-700 text-zinc-200"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-zinc-300 mb-1">
              Fed?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFed(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  fed
                    ? "bg-cyan-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setFed(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !fed
                    ? "bg-zinc-700 text-zinc-200"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>

        {/* Training Event */}
        <div>
          <span className="block text-sm font-medium text-zinc-300 mb-1">
            Training Event
          </span>
          <div className="flex flex-wrap gap-2">
            {TRAINING_EVENTS.map((event) => (
              <button
                key={event}
                type="button"
                onClick={() => setTrainingEvent(event)}
                className={`py-1.5 px-3 rounded-full text-xs font-medium transition-colors ${
                  trainingEvent === event
                    ? "bg-cyan-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {event}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            Notes
          </label>
          <input
            type="text"
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="Quick single-line observation..."
            maxLength={100}
          />
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <p
            className={`text-center text-sm font-medium ${
              feedback.type === "success" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {feedback.message}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || plants.length === 0}
          className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Recording Check-In..." : "Finish Check-In"}
        </button>
      </form>
    </div>
  );
}