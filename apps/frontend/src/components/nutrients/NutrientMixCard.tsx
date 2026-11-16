"use client";

import { useMemo, useState } from "react";
import {
  FlaskConical,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Sprout,
  Copy,
  Check,
  Minus,
} from "lucide-react";
import {
  commercialFeedSchedules,
  type FeedSchedule,
  type NutrientDose,
} from "@/lib/cultivation-engine";
import {
  NUTRIENT_TARGETS,
  computeSuppliedMgPerL,
  compareToTargets,
  type ComparisonRow,
} from "@/lib/nutrient-model";
import {
  SUBSTRATE_PROFILES,
  computeSubstrateContribution,
} from "@/lib/substrate-profiles";

interface NutrientMixCardProps {
  /** Default feed line — typically profile.activeFeedLine. Falls back to
   *  the first stage-matched schedule when null. */
  defaultFeedLineId?: string | null;
  plantStage?: string;
  /** Default substrate profile id. Falls back to coco_perlite_vermiculite. */
  substrate?: string | null;
  /** Pot size, used by the substrate model. Falls back to 5.0. */
  containerGallons?: number | null;
  weeksIntoGrow?: number | null;
  /** Called when the user confirms the mix. Carries the actual mix volume
   *  (gallons), the selected feed line id, and the per-product mL/gal doses. */
  onMixReady?: (data: {
    feedLineId: string;
    doses: Record<string, number>;
    gallons: number;
  }) => void;
}

export function NutrientMixCard({
  defaultFeedLineId,
  plantStage,
  substrate,
  containerGallons,
  weeksIntoGrow,
  onMixReady,
}: NutrientMixCardProps) {
  // ---------- Schedule selection ----------
  const defaultSchedule = useMemo<FeedSchedule>(() => {
    if (defaultFeedLineId) {
      const match = commercialFeedSchedules.find((s) => s.id === defaultFeedLineId);
      if (match) return match;
    }
    if (plantStage) {
      const match = commercialFeedSchedules.find(
        (s) => s.stage?.toLowerCase() === plantStage.toLowerCase(),
      );
      if (match) return match;
    }
    return commercialFeedSchedules[0];
  }, [defaultFeedLineId, plantStage]);

  const [activeLineId, setActiveLineId] = useState<string>(defaultSchedule.id);
  const activeSchedule = useMemo<FeedSchedule>(
    () => commercialFeedSchedules.find((s) => s.id === activeLineId) || defaultSchedule,
    [activeLineId, defaultSchedule],
  );

  // ---------- Mix volume ----------
  const [gallons, setGallons] = useState<number>(3);

  // ---------- Per-product doses (mL/gal), editable ----------
  const [doses, setDoses] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const d of defaultSchedule.doses) initial[d.product] = d.mlPerGallon;
    return initial;
  });

  const handleLineChange = (newId: string) => {
    setActiveLineId(newId);
    const schedule = commercialFeedSchedules.find((s) => s.id === newId);
    if (!schedule) return;
    const newDoses: Record<string, number> = {};
    for (const d of schedule.doses) newDoses[d.product] = d.mlPerGallon;
    setDoses(newDoses);
  };

  // ---------- Substrate ----------
  const [activeSubstrate, setActiveSubstrate] = useState<string>(() => {
    if (substrate && SUBSTRATE_PROFILES[substrate]) return substrate;
    if (substrate === "happy_frog") return "happy_frog";
    if (substrate === "coco") return "coco_perlite";
    return "coco_perlite_vermiculite";
  });
  const [weekOverride, setWeekOverride] = useState<number | null>(weeksIntoGrow ?? null);
  const effectiveWeek = weekOverride ?? weeksIntoGrow ?? 0;
  const effectivePotGal = containerGallons ?? 5.0;
  const substrateProfile = SUBSTRATE_PROFILES[activeSubstrate];

  // ---------- Nutrient math ----------
  const stageKey = (plantStage || "vegetative").toLowerCase();
  const stageData = NUTRIENT_TARGETS[stageKey] ?? NUTRIENT_TARGETS.vegetative;

  const suppliedFromProducts = useMemo(() => {
    return activeSchedule.doses.reduce(
      (acc, d) => {
        if (!d.guaranteedPct) return acc;
        const ml = doses[d.product] ?? 0;
        const s = computeSuppliedMgPerL(d.guaranteedPct, ml);
        return {
          N: acc.N + s.N,
          P: acc.P + s.P,
          K: acc.K + s.K,
          Ca: acc.Ca + s.Ca,
          Mg: acc.Mg + s.Mg,
        };
      },
      { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 },
    );
  }, [activeSchedule, doses]);

  const suppliedFromSubstrate = {
    N: computeSubstrateContribution(substrateProfile, "N", effectiveWeek, effectivePotGal),
    P: computeSubstrateContribution(substrateProfile, "P", effectiveWeek, effectivePotGal),
    K: computeSubstrateContribution(substrateProfile, "K", effectiveWeek, effectivePotGal),
    Ca: computeSubstrateContribution(substrateProfile, "Ca", effectiveWeek, effectivePotGal),
    Mg: computeSubstrateContribution(substrateProfile, "Mg", effectiveWeek, effectivePotGal),
  };

  const totalSupplied = {
    N: suppliedFromProducts.N + suppliedFromSubstrate.N,
    P: suppliedFromProducts.P + suppliedFromSubstrate.P,
    K: suppliedFromProducts.K + suppliedFromSubstrate.K,
    Ca: suppliedFromProducts.Ca + suppliedFromSubstrate.Ca,
    Mg: suppliedFromProducts.Mg + suppliedFromSubstrate.Mg,
  };

  const comparisons = compareToTargets(totalSupplied, stageData.targets);

  const hasMissingLabels = activeSchedule.doses.some((d) => !d.guaranteedPct);

  const nRow = comparisons.find((c) => c.element === "N");
  const scaleRecommendation =
    nRow && nRow.verdict === "low" && nRow.supplied > 0
      ? Math.round((stageData.targets.N / nRow.supplied) * 100) / 100
      : null;

  // ---------- Mix steps ----------
  const steps = useMemo(() => {
    const result: Array<{ order: number; text: string; detail?: string }> = [];
    result.push({ order: 1, text: `Fill ${gallons.toFixed(1)} gallons of water` });
    activeSchedule.doses.forEach((dose: NutrientDose, i: number) => {
      const ml = doses[dose.product] ?? dose.mlPerGallon;
      const totalMl = ml * gallons;
      result.push({
        order: i + 2,
        text: `Add ${dose.product}`,
        detail: `${totalMl.toFixed(1)} mL  (${ml} mL/gal)`,
      });
    });
    result.push({
      order: activeSchedule.doses.length + 2,
      text: `Check pH`,
      detail: `Target ${activeSchedule.targetPh?.toFixed(1) ?? "5.8"}`,
    });
    result.push({
      order: activeSchedule.doses.length + 3,
      text: `Check EC`,
      detail: `Target ${activeSchedule.targetEc.toFixed(1)}`,
    });
    return result;
  }, [activeSchedule, doses, gallons]);

  // ---------- Copy ----------
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const text = [
      activeSchedule.label,
      `Mix ${gallons.toFixed(1)} gallons`,
      "",
      ...steps.map((s) => `${s.order}. ${s.text}${s.detail ? " — " + s.detail : ""}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — no-op
    }
  };

  const [expanded, setExpanded] = useState(false);
  const isLastWeek = weeksIntoGrow !== null && weeksIntoGrow !== undefined && weeksIntoGrow >= 8;

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Nutrient Mix — {stageData.label}
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-zinc-400" />
        ) : (
          <ChevronDown className="size-4 text-zinc-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-3">
            {stageData.notes}
          </p>

          {/* Feed line + gallons */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Feed line
              </label>
              <select
                value={activeLineId}
                onChange={(e) => handleLineChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-semibold"
              >
                {commercialFeedSchedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Gallons to mix
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setGallons((g) => Math.max(0.5, g - 0.5))}
                  className="p-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Minus className="size-3" />
                </button>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={gallons}
                  onChange={(e) => setGallons(Number(e.target.value) || 0.5)}
                  className="flex-1 w-full px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-mono text-center"
                />
                <button
                  type="button"
                  onClick={() => setGallons((g) => g + 0.5)}
                  className="p-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ArrowUp className="size-3" />
                </button>
              </div>
            </div>
          </div>

          {/* pH/EC targets */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span>
              pH target <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{activeSchedule.targetPh?.toFixed(1) ?? "5.8"}</span>
            </span>
            <span>
              EC target <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{activeSchedule.targetEc.toFixed(1)}</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy mix"}
            </button>
          </div>

          {/* Mix order */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Mix order
            </div>
            <ol className="space-y-2">
              {steps.map((step) => (
                <li key={step.order} className="flex gap-2">
                  <div className="shrink-0 size-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    {step.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-white">
                      {step.text}
                    </p>
                    {step.detail && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Substrate */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sprout className="size-3" />
              Substrate
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={activeSubstrate}
                onChange={(e) => setActiveSubstrate(e.target.value)}
                className="px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs"
              >
                {Object.entries(SUBSTRATE_PROFILES).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">Week</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={effectiveWeek}
                  onChange={(e) => setWeekOverride(Number(e.target.value))}
                  className="w-14 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-mono text-right"
                />
                <span className="text-[10px] text-zinc-400">
                  / {substrateProfile.releaseWeeks || "inert"}
                </span>
              </div>
            </div>
            {substrateProfile.releaseWeeks > 0 && (
              <p className="text-[10px] text-zinc-500 mt-1.5">{substrateProfile.notes}</p>
            )}
            {substrateProfile.releaseWeeks === 0 && (
              <p className="text-[10px] text-zinc-500 mt-1.5">
                Inert substrate — no contribution. All nutrients from feed.
              </p>
            )}
          </div>

          {/* Per-product editable doses */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Your feed (mL/gal, editable)
            </h4>
            <div className="space-y-1.5">
              {activeSchedule.doses.map((p) => (
                <div key={p.product} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                    {p.product}
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={doses[p.product] ?? 0}
                    onChange={(e) =>
                      setDoses({ ...doses, [p.product]: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-mono text-right"
                  />
                  <span className="text-[10px] text-zinc-500 w-10">mL/gal</span>
                </div>
              ))}
            </div>
            {hasMissingLabels && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                Some products in this feed line have no label data yet — their mg/L
                contribution is not counted in the totals below.
              </p>
            )}
          </div>

          {/* Target comparison */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Total supply vs. target
            </h4>
            <div className="space-y-1">
              {comparisons.map((c) => (
                <ComparisonRowView
                  key={c.element}
                  row={c}
                  substrateContribution={suppliedFromSubstrate[c.element]}
                />
              ))}
            </div>
          </div>

          {scaleRecommendation && scaleRecommendation > 1.15 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-300">
                Under-target on N.
              </span>{" "}
              <span className="text-amber-800 dark:text-amber-400">
                Increase all feed doses by ~{Math.round((scaleRecommendation - 1) * 100)}%
                to hit the target. Re-check runoff EC after the next watering.
              </span>
            </div>
          )}

          {isLastWeek && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              <span className="font-semibold">Week 8+.</span> Consider lowering EC and
              starting a flush. See the harvest checklist.
            </p>
          )}

          <p className="text-[10px] text-zinc-500 italic pt-2 border-t border-zinc-100 dark:border-zinc-800">
            Substrate contribution is a calibrated model, not a lab measurement. Pot
            size scales it linearly; week drives the release decay. Trust the plant's
            response over the model.
          </p>

          {onMixReady && (
            <button
              type="button"
              onClick={() =>
                onMixReady({ feedLineId: activeLineId, doses, gallons })
              }
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Nutrients mixed, ready to feed
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonRowView({
  row,
  substrateContribution,
}: {
  row: ComparisonRow;
  substrateContribution: number;
}) {
  const verdictColor =
    row.verdict === "low"
      ? "text-amber-500"
      : row.verdict === "high"
        ? "text-red-500"
        : "text-emerald-500";

  const VerdictIcon =
    row.verdict === "low" ? ArrowDown : row.verdict === "high" ? ArrowUp : CheckCircle2;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-6 font-bold text-zinc-500">{row.element}</span>
      <span className="flex-1 text-zinc-700 dark:text-zinc-300 font-mono">
        {row.supplied.toFixed(0)} / {row.target} mg/L
        {substrateContribution > 0 && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-1">
            (incl. {substrateContribution.toFixed(0)} from substrate)
          </span>
        )}
      </span>
      <span className={`font-mono text-[10px] ${verdictColor}`}>
        {row.pctOfTarget.toFixed(0)}%
      </span>
      <VerdictIcon className={`size-3.5 ${verdictColor}`} />
    </div>
  );
}