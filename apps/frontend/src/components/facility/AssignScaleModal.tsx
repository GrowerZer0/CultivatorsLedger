"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2, X, AlertCircle } from "lucide-react";
import { getAvailableLoadCells, assignSensorToPlant } from "@/server/actions/sensors";

interface AssignScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  plantName: string;
}

interface SensorOption {
  id: string;
  name: string;
  type: string;
}

export function AssignScaleModal({
  isOpen,
  onClose,
  plantId,
  plantName,
}: AssignScaleModalProps) {
  const router = useRouter();
  const [sensors, setSensors] = useState<SensorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    
    getAvailableLoadCells()
      .then((rows) => {
        setSensors(rows);
        if (rows.length === 0) {
          setError("No unassigned load cells found. You can add one in Settings → Hardware.");
        }
      })
      .catch((err) => {
        setError(err?.message || "Failed to load available scales.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  const handleAssign = (sensorId: string) => {
    startTransition(async () => {
      const res = await assignSensorToPlant({ sensorId, plantId });
      if (res.success) {
        onClose();
        router.refresh(); // Refresh the page to show the newly assigned sensor
      } else {
        setError(res.error || "Failed to assign scale.");
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-emerald-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Assign Scale to {plantName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-zinc-500">
              <Loader2 className="size-5 animate-spin mr-2" />
              Loading available scales...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : sensors.length === 0 ? (
             <div className="text-center py-6">
               <p className="text-sm text-zinc-500">No available load cells.</p>
             </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 mb-3">
                Select an available load cell to monitor this plant's weight.
              </p>
              {sensors.map((sensor) => (
                <button
                  key={sensor.id}
                  onClick={() => handleAssign(sensor.id)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-zinc-50 dark:bg-zinc-800/50 transition-colors text-left disabled:opacity-50"
                >
                  <div>
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                      {sensor.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {sensor.type}
                    </div>
                  </div>
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin text-emerald-500" />
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Assign →
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}