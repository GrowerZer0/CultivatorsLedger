"use client";

import { useState } from "react";
import {
  FlaskConical,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Sprout,
} from "lucide-react";
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

const PRODUCT_LINES: Record<
  string,
  {
    label: string;
    products: Array<{
      name: string;
      guaranteedPct: { N: number; P: number; K: number; Ca?: number; Mg?: number };
      defaultMlPerGal: number;
    }>;
  }
> = {
  gh_flora: {
    label: "General Hydroponics Flora Trio",
    products: [
      { name: "FloraMicro", guaranteedPct: { N: 5, P: 0, K: 1, Ca: 5 }, defaultMlPerGal: 4 },
      { name: "FloraGro", guaranteedPct: { N: 2, P: 1, K: 6 }, defaultMlPerGal: 2 },
      { name: "FloraBloom", guaranteedPct: { N: 0, P: 5, K: 4 }, defaultMlPerGal: 1 },
      { name: "CaliMagic", guaranteedPct: { N: 2, P: 0, K: 0, Ca: 3.2, Mg: 1.2 }, defaultMlPerGal: 1 },
    ],
  },
  athena_blended: {
    label: "Athena Blended",
    products: [
      { name: "Grow A", guaranteedPct: { N: 5, P: 0, K: 0, Ca: 4.5 }, defaultMlPerGal: 6 },
      { name: "Grow B", guaranteedPct: { N: 0, P: 4, K: 5, Mg: 1 }, defaultMlPerGal: 6 },
      { name: "Cleanse", guaranteedPct: { N: 0, P: 0, K: 0 }, defaultMlPerGal: 2.5 },
    ],
  },
};

interface NutrientTargetsCardProps {
  stage: string;
  nutrientLine?: string | null;
  substrate?: string | null;
  containerGallons?: number | null;
  weeksIntoGrow?: number | null;
}

export function NutrientTargetsCard({
  stage,
  nutrientLine,
  substrate,
  containerGallons,
  weeksIntoGrow,
}: NutrientTargetsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeLine, setActiveLine] = useState<string>(
    nutrientLine && PRODUCT_LINES[nutrientLine] ? nutrientLine : "gh_flora",
  );

  // Substrate: default to plant's value, fall back to inert (safe default)
  const [activeSubstrate, setActiveSubstrate] = useState<string>(() => {
    if (substrate && SUBSTRATE_PROFILES[substrate]) return substrate;
    // Common plant.substrate values → profile id mapping
    if (substrate === "happy_frog") return "happy_frog";
    if (substrate === "coco") return "coco_perlite";
    // Coco/perlite/vermiculite is the user's actual mix — matches inert profile
    return "coco_perlite_vermiculite";
  });

  // Week into grow: default from prop, user can override
  const [weekOverride, setWeekOverride] = useState<number | null>(
    weeksIntoGrow ?? null,
  );

  const effectiveWeek = weekOverride ?? weeksIntoGrow ?? 0;
  const effectivePotGal = containerGallons ?? 5.0;

  const [doses, setDoses] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const p of PRODUCT_LINES[activeLine]?.products ?? []) {
      initial[p.name] = p.defaultMlPerGal;
    }
    return initial;
  });

  const stageKey = (stage || "vegetative").toLowerCase();
  const stageData = NUTRIENT_TARGETS[stageKey] ?? NUTRIENT_TARGETS.vegetative;
  const productLine = PRODUCT_LINES[activeLine];
  const substrateProfile = SUBSTRATE_PROFILES[activeSubstrate];

  // Product contribution
  const suppliedFromProducts = productLine.products.reduce(
    (acc, p) => {
      const ml = doses[p.name] ?? 0;
      const s = computeSuppliedMgPerL(p.guaranteedPct, ml);
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

  // Substrate contribution
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

  // Recommendation: scale doses by (target/supplied) if materially under target
  const nRow = comparisons.find((c) => c.element === "N");
  const scaleRecommendation =
    nRow && nRow.verdict === "low" && nRow.supplied > 0
      ? Math.round((stageData.targets.N / nRow.supplied) * 100) / 100
      : null;

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Nutrient Targets — {stageData.label}
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

          {/* Target table */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Target concentration
            </h4>
            <div className="grid grid-cols-5 gap-1 text-center">
              {(["N", "P", "K", "Ca", "Mg"] as const).map((el) => (
                <div key={el} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">{el}</div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                    {stageData.targets[el]}
                  </div>
                  <div className="text-[9px] text-zinc-400">mg/L</div>
                </div>
              ))}
            </div>
          </div>

          {/* Substrate block */}
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
              <p className="text-[10px] text-zinc-500 mt-1.5">
                {substrateProfile.notes}
              </p>
            )}
            {substrateProfile.releaseWeeks === 0 && (
              <p className="text-[10px] text-zinc-500 mt-1.5">
                Inert substrate — no contribution. All nutrients from feed.
              </p>
            )}
          </div>

          {/* Product line + doses */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Your feed (mL/gal)
            </h4>
            <select
              value={activeLine}
              onChange={(e) => {
                setActiveLine(e.target.value);
                const newDoses: Record<string, number> = {};
                for (const p of PRODUCT_LINES[e.target.value]?.products ?? []) {
                  newDoses[p.name] = p.defaultMlPerGal;
                }
                setDoses(newDoses);
              }}
              className="w-full mb-2 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs"
            >
              {Object.entries(PRODUCT_LINES).map(([id, line]) => (
                <option key={id} value={id}>
                  {line.label}
                </option>
              ))}
            </select>
            <div className="space-y-1.5">
              {productLine.products.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1">
                    {p.name}
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={doses[p.name] ?? 0}
                    onChange={(e) =>
                      setDoses({ ...doses, [p.name]: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-mono text-right"
                  />
                  <span className="text-[10px] text-zinc-500 w-10">mL/gal</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison */}
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

          {/* Scale recommendation */}
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

          <p className="text-[10px] text-zinc-500 italic pt-2 border-t border-zinc-100 dark:border-zinc-800">
            Phase B heuristic: substrate contribution is a calibrated model, not a
            lab measurement. Pot size scales the contribution linearly; week drives
            the release decay. Trust the plant's response over the model.
          </p>
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
    row.verdict === "low"
      ? ArrowDown
      : row.verdict === "high"
        ? ArrowUp
        : CheckCircle2;

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