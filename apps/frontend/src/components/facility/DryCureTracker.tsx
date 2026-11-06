"use client";

import { useEffect, useState } from "react";
import { Scale, Droplet, CheckCircle2, Loader2 } from "lucide-react";
import { saveSeedlingCheck } from "@/server/actions/seedling";
import { logCureEvent, getCureEvents, deleteCureEvent } from "@/server/actions/cure";

interface DryCureTrackerProps {
  plantId: string;
  stage: string;
  lastWeight: number | null;
  cureStartedAt?: string | null;
}

interface CureEventRow {
  id: string;
  occurredAt: string;
  eventType: string;
  durationMins: number | null;
  notes: string | null;
}

export function DryCureTracker({
  plantId,
  stage,
  lastWeight,
  cureStartedAt,
}: DryCureTrackerProps) {
  const [weight, setWeight] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isBurping, setIsBurping] = useState(false);
  const [burpError, setBurpError] = useState<string | null>(null);
  const [pendingBurpId, setPendingBurpId] = useState<string | null>(null);

  const [cureEvents, setCureEvents] = useState<CureEventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const isDry = stage === "dry";

  // Load burp history when this component mounts in cure mode
  useEffect(() => {
    if (isDry) return;
    let cancelled = false;
    setEventsLoading(true);
    getCureEvents(plantId)
      .then((rows) => {
        if (!cancelled) setCureEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setCureEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plantId, isDry]);

  // Burp counts
  const burpsToday = cureEvents.filter(
    (e) =>
      e.eventType === "burp" &&
      new Date(e.occurredAt).toDateString() === new Date().toDateString(),
  ).length;

  const cureDays = cureStartedAt
    ? Math.floor((Date.now() - new Date(cureStartedAt).getTime()) / 86_400_000)
    : 0;
  const expectedBurpsToday = cureDays < 7 ? 2 : 1;
  const burpsRemaining = Math.max(0, expectedBurpsToday - burpsToday);

  const lastBurpAt = cureEvents[0]?.occurredAt
    ? new Date(cureEvents[0].occurredAt)
    : null;

  const handleSave = async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) return alert("Please enter a valid weight.");

    setIsSaving(true);
    await saveSeedlingCheck({
      plantId,
      plugWeightG: weightNum,
      symptoms: ["dry_check"],
    });
    setIsSaving(false);
    setWeight("");
    window.location.reload();
  };

  const handleBurp = async () => {
    setIsBurping(true);
    setBurpError(null);
    const res = await logCureEvent({ plantId, eventType: "burp" });
    setIsBurping(false);
    if (!res.success) {
      setBurpError(res.error);
      return;
    }
    setCureEvents((prev) => [res.event, ...prev]);
    setPendingBurpId(res.event.id);
    setTimeout(() => setPendingBurpId(null), 5000);
  };

  const handleUndoBurp = async () => {
    if (!pendingBurpId) return;
    await deleteCureEvent(pendingBurpId);
    setCureEvents((prev) => prev.filter((e) => e.id !== pendingBurpId));
    setPendingBurpId(null);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className={`text-lg font-bold flex items-center gap-2 ${isDry ? "text-amber-500" : "text-emerald-500"}`}>
          {isDry ? "🍂 Drying Tracker" : "🫙 Curing Tracker"}
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          {isDry
            ? "Target: 60°F / 60% RH. Check weight daily. Ready to cure when weight loss stalls."
            : "Target: 58-62% RH. Burp jars twice daily week 1, then daily."}
        </p>
      </div>

      {isDry ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1.5 mb-1">
              <Scale className="size-3.5" /> Current Weight (Grams)
            </label>
            <input
              type="number"
              placeholder={lastWeight ? `Last: ${lastWeight}g` : "e.g. 150"}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold text-lg"
            />
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center">
            <p className="text-xs font-bold text-zinc-500 uppercase">Environment Status</p>
            <p className="text-sm font-semibold text-emerald-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="size-4" /> VPD & RH in range
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Today's Action */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Today&apos;s Action</p>
            {eventsLoading ? (
              <Loader2 className="size-4 animate-spin text-zinc-400" />
            ) : burpsToday >= expectedBurpsToday ? (
              <p className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="size-4" /> Done for today ({burpsToday}/{expectedBurpsToday})
              </p>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleBurp}
                  disabled={isBurping}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {isBurping && <Loader2 className="size-4 animate-spin" />}
                  Log Burp
                </button>
                <p className="text-[10px] text-zinc-500">
                  {burpsToday}/{expectedBurpsToday} today · {burpsRemaining} remaining
                </p>
              </div>
            )}
            {lastBurpAt && (
              <p className="text-[10px] text-zinc-400 mt-2">
                Last burp:{" "}
                {lastBurpAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {lastBurpAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {!lastBurpAt && !eventsLoading && (
              <p className="text-[10px] text-zinc-400 mt-2">No burps logged yet.</p>
            )}
            {burpError && (
              <p className="text-[10px] text-red-500 mt-2">{burpError}</p>
            )}
            <p className="text-[10px] text-zinc-400 mt-2">
              {cureDays < 7 ? "Burp twice daily in Week 1." : "Burp once daily."}
            </p>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center">
            <p className="text-xs font-bold text-zinc-500 uppercase">Jar RH Target</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-1 flex items-center gap-1">
              <Droplet className="size-4 text-blue-500" /> 58% - 62% RH
            </p>
            <p className="text-[10px] text-zinc-400 mt-2">
              If RH is too high, leave jars open for 1 hour. If too low, add a Boveda pack.
            </p>
          </div>
        </div>
      )}

      {isDry && (
        <button
          onClick={handleSave}
          disabled={isSaving || !weight}
          className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 bg-amber-600 hover:bg-amber-500"
        >
          {isSaving ? <Loader2 className="size-5 animate-spin" /> : "Log Weight"}
        </button>
      )}

      {/* Undo toast */}
      {pendingBurpId && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 text-white px-4 py-2 rounded-lg shadow-xl z-50 flex items-center gap-3">
          <span className="text-sm">Burp logged</span>
          <button
            onClick={handleUndoBurp}
            className="text-emerald-400 font-bold hover:underline text-sm"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}