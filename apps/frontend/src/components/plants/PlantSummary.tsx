"use client";

import Link from "next/link";
import { Droplet, Loader2, CheckCircle2 } from "lucide-react";
import { WeightInput } from "@/components/dashboard/WeightInput";
import type { Plant } from "@/types/plant";
import { useState, useEffect } from "react";
import { getCureEvents, logCureEvent } from "@/server/actions/cure";
import { CureLogModal } from "@/components/plants/CureLogModal";
import { deleteCureEvent } from "@/server/actions/cure";

function DryCureSummaryRow({
  plant,
  isCure,
  dayCount,
  latestWeight,
  href,
}: {
  plant: Plant;
  isCure: boolean;
  dayCount: number;
  latestWeight: number | null;
  href: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isBurping, setIsBurping] = useState(false);
  const [burpsToday, setBurpsToday] = useState<number | null>(null);
  const [burpError, setBurpError] = useState<string | null>(null);
const [pendingBurpId, setPendingBurpId] = useState<string | null>(null);
const [pendingToastVisible, setPendingToastVisible] = useState(false);

  // Load burp count on mount
  useEffect(() => {
    if (!isCure) return;
    let cancelled = false;
    getCureEvents(plant.id)
      .then((rows) => {
        if (cancelled) return;
        const today = new Date().toDateString();
        const count = rows.filter(
          (e) =>
            e.eventType === "burp" &&
            new Date(e.occurredAt).toDateString() === today,
        ).length;
        setBurpsToday(count);
      })
      .catch(() => {
        if (!cancelled) setBurpsToday(0);
      });
    return () => {
      cancelled = true;
    };
  }, [plant.id, isCure]);

  const cureDays = plant.currentStageStartedAt
    ? Math.floor(
        (Date.now() - new Date(plant.currentStageStartedAt).getTime()) /
          86_400_000,
      )
    : 0;
  const expectedBurpsToday = cureDays < 7 ? 2 : 1;
  const burpsRemaining =
    burpsToday === null
      ? null
      : Math.max(0, expectedBurpsToday - burpsToday);

const handleLogBurp = async () => {
  setIsBurping(true);
  setBurpError(null);
  const res = await logCureEvent({ plantId: plant.id, eventType: "burp" });
  setIsBurping(false);
  if (!res.success) {
    setBurpError(res.error);
    return;
  }
  setBurpsToday((n) => (n ?? 0) + 1);
  setPendingBurpId(res.event.id);
  setPendingToastVisible(true);

  // Auto-clear the toast after 5s. If the user clicks Undo first, we
  // clear it early (see handleUndoBurp).
  setTimeout(() => {
    setPendingToastVisible(false);
    setPendingBurpId(null);
  }, 5000);
};

const handleUndoBurp = async () => {
  if (!pendingBurpId) return;
  const idToDelete = pendingBurpId;
  // Clear the toast immediately so the user gets instant feedback
  setPendingToastVisible(false);
  setPendingBurpId(null);

  // Optimistic UI: revert the count
  setBurpsToday((n) => Math.max(0, (n ?? 1) - 1));

  await deleteCureEvent(idToDelete);
};

  const burpLabel =
    burpsRemaining === null
      ? "Log Burp"
      : burpsRemaining === 0
        ? "Burped today"
        : `Log Burp (${burpsRemaining} left)`;

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
        <Link href={href} className="flex items-center gap-2 min-w-0 flex-1">
          <div className="size-11 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            {plant.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={plant.thumbnailUrl}
                alt={plant.name}
                className="size-11 object-cover"
              />
            ) : (
              <div className="size-11 grid place-items-center text-zinc-400 text-xs">
                —
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {plant.name}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                  isCure
                    ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50"
                    : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
                }`}
              >
                {isCure ? "Curing" : "Drying"}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
              <span className="font-mono">Day {dayCount}</span>
              {plant.strain && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="truncate">
                    {plant.strain}
                    {plant.breeder && ` · ${plant.breeder}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>

        {isCure ? (
          <div className="shrink-0 flex flex-col items-end gap-1">
            <button
              onClick={handleLogBurp}
              disabled={isBurping || burpsRemaining === 0}
              className={`px-2.5 py-1.5 rounded-lg text-white text-xs font-bold transition-colors flex items-center gap-1 ${
                burpsRemaining === 0
                  ? "bg-zinc-600 opacity-60 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500"
              } disabled:opacity-60`}
            >
              {isBurping ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : burpsRemaining === 0 ? (
                <CheckCircle2 className="size-3.5" />
              ) : null}
              {burpLabel}
            </button>
            {burpError && (
              <span className="text-[10px] text-red-500">{burpError}</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-white text-xs font-bold transition-colors bg-amber-600 hover:bg-amber-500"
          >
            Log Weight
          </button>
        )}
      </div>

      {/* Dry-only modal for weight logging (still uses tracker) */}
      {!isCure && (
        <CureLogModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          plantId={plant.id}
          plantName={plant.name}
          stage="dry"
          lastWeight={latestWeight}
          cureStartedAt={plant.currentStageStartedAt ?? null}
        />
      )}
      {pendingToastVisible && pendingBurpId && (
  <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white shadow-xl border border-zinc-700">
    <CheckCircle2 className="size-4 text-emerald-400" />
    <span className="text-sm font-semibold">Burp logged</span>
    <button
      onClick={handleUndoBurp}
      className="text-emerald-400 font-bold text-sm hover:underline"
    >
      Undo
    </button>
  </div>
)}
    </>
  );
}

type Variant = "row" | "card" | "header";

interface PlantSummaryProps {
  plant: Plant;
  latestWeight: number | null;
  latestReadingMinutesAgo: number | null;
  drybackPercent: number | null;
  stageLabel: string;
  weekLabel: string;
  weightDisplay: string;
  fcDisplay: string | null;
  useGrams: boolean;
  thumbnailUrl?: string | null;
  variant?: Variant;
  href?: string;
  onWater?: (plantId: string) => void;
}

export function PlantSummary({
  plant,
  latestWeight,
  latestReadingMinutesAgo,
  drybackPercent,
  stageLabel,
  weekLabel,
  weightDisplay,
  fcDisplay,
  useGrams,
  thumbnailUrl,
  variant = "row",
  href = `/plants/${plant.id}`,
  onWater,
}: PlantSummaryProps) {
  const isCard = variant === "card";
  const isHeader = variant === "header";
  const isCure = plant.stage === "cure";
  const isDry = plant.stage === "dry";

  const needsWater = drybackPercent !== null && drybackPercent >= 15;
  const hasNoSensor = (plant.sensorConfigs ?? []).length === 0;
  const showWaterButton = onWater && (needsWater || hasNoSensor);

  const weightBlock = (
    <div className="flex flex-col">
      <WeightInput
        plantId={plant.id}
        currentWeightLbs={latestWeight}
        unitLabel={useGrams ? "g" : "lbs"}
        displayValue={weightDisplay}
        isSmallScale={useGrams}
        hasAssignedScale={(plant.sensorConfigs ?? []).length > 0}
        minutesSinceReading={latestReadingMinutesAgo}
      />
      {plant.sensorConfigs && plant.sensorConfigs.length > 0 && (
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono pl-1 mt-0.5">
          {plant.sensorConfigs[0].name}
        </span>
      )}
    </div>
  );

  const badge = (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border border-zinc-200 dark:border-zinc-700">
      {stageLabel}
    </span>
  );

  const metaLine = (
    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
        {weekLabel}
      </span>
      <span className="text-zinc-300 dark:text-zinc-700">·</span>
      {weightBlock}
      {fcDisplay && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
          {fcDisplay}
        </span>
      )}
    </div>
  );

  // ==========================================================
  // DRY / CURE — compact row with Log button that opens modal
  // ==========================================================
  if (isCure || isDry) {
    const stageStarted = plant.currentStageStartedAt || plant.updatedAt;
    const dayCount = stageStarted
      ? Math.floor((Date.now() - new Date(stageStarted).getTime()) / 86_400_000) + 1
      : 1;

    return (
      <DryCureSummaryRow
        plant={plant}
        isCure={isCure}
        dayCount={dayCount}
        latestWeight={latestWeight}
        href={href}
      />
    );
  }

  // ==========================================================
  // HEADER (plant detail page)
  // ==========================================================
  if (isHeader) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">
            {plant.name}
          </h1>
          {badge}
        </div>
        {(plant.strain || plant.breeder) && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            {plant.strain || "Unknown strain"}
            {plant.breeder && (
              <span className="text-zinc-400 dark:text-zinc-500">
                {" · "}
                {plant.breeder}
              </span>
            )}
          </p>
        )}
        {metaLine}
      </div>
    );
  }

  // ==========================================================
  // CARD (plants grid view)
  // ==========================================================
  if (isCard) {
    return (
      <Link
        href={href}
        className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 hover:border-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex flex-col gap-3">
          <div className="aspect-square w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt={plant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-zinc-400 text-xs">
                No photo
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-zinc-900 dark:text-white truncate">
              {plant.name}
            </span>
            {badge}
            {(plant.strain || plant.breeder) && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {plant.strain || "Unknown"}
                {plant.breeder && ` · ${plant.breeder}`}
              </span>
            )}
          </div>
          {metaLine}
          {showWaterButton && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onWater!(plant.id);
              }}
              className={`w-full py-1.5 rounded-lg text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                needsWater
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-zinc-600 hover:bg-zinc-500"
              }`}
            >
              <Droplet className="size-3.5" />
              {needsWater ? "Water Now" : "Log Irrigation"}
            </button>
          )}
        </div>
      </Link>
    );
  }

  // ==========================================================
  // ROW (dashboard / plants list)
  // ==========================================================
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
    >
      <div className="size-11 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={plant.name}
            className="size-11 object-cover"
          />
        ) : (
          <div className="size-11 grid place-items-center text-zinc-400 text-xs">
            —
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {plant.name}
          </span>
          {badge}
          {(plant.strain || plant.breeder) && (
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {plant.strain || "Unknown"}
              {plant.breeder && ` · ${plant.breeder}`}
            </span>
          )}
        </div>
        {metaLine}
      </div>
      {drybackPercent !== null && (
        <div className="shrink-0 text-right">
          <div
            className={`text-lg font-bold ${
              drybackPercent >= 20
                ? "text-red-500"
                : drybackPercent >= 15
                  ? "text-amber-500"
                  : "text-emerald-500"
            }`}
          >
            {drybackPercent.toFixed(1)}%
          </div>
          <div className="text-[9px] text-zinc-400 uppercase tracking-wider">
            dryback
          </div>
        </div>
      )}
      {showWaterButton && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onWater!(plant.id);
          }}
          className={`shrink-0 px-2.5 py-1.5 rounded-lg text-white text-xs font-bold transition-colors flex items-center gap-1 ${
            needsWater
              ? "bg-blue-600 hover:bg-blue-500"
              : "bg-zinc-600 hover:bg-zinc-500"
          }`}
          title={needsWater ? "Plant needs water" : "Log irrigation"}
        >
          <Droplet className="size-3.5" />
          <span className="hidden md:inline">{needsWater ? "Water" : "Log"}</span>
        </button>
      )}
    </Link>
  );
}