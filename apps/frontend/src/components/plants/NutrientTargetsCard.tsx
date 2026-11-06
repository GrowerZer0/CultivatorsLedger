"use client";

import { useState } from "react";
import { FlaskConical, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp } from "lucide-react";
import {
  NUTRIENT_TARGETS,
  computeSuppliedMgPerL,
  compareToTargets,
  type ComparisonRow,
} from "@/lib/nutrient-model";

// A few common product lines, predefined. Can be expanded later.
// Values are from the product labels (guaranteed analysis).
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
}

export function NutrientTargetsCard({ stage, nutrientLine }: NutrientTargetsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeLine, setActiveLine] = useState<string>(
    nutrientLine && PRODUCT_LINES[nutrientLine] ? nutrientLine : "gh_flora",
  );
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

  // Compute supplied nutrients from all products at user's doses
  const supplied = productLine.products.reduce(
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

  const comparisons = compareToTargets(supplied, stageData.targets);

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

          {/* Product line + doses */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Your mix (mL/gal)
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
              Supplied vs. target
            </h4>
            <div className="space-y-1">
              {comparisons.map((c) => (
                <ComparisonRowView key={c.element} row={c} />
              ))}
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 italic pt-2 border-t border-zinc-100 dark:border-zinc-800">
            Phase A: this shows whether your current mix matches published targets. It
            doesn't subtract substrate contribution yet — if you're in Happy Frog
            or another pre-charged soil, expect to need less than the target for the
            first few weeks.
          </p>
        </div>
      )}
    </div>
  );
}

function ComparisonRowView({ row }: { row: ComparisonRow }) {
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
      </span>
      <span className={`font-mono text-[10px] ${verdictColor}`}>
        {row.pctOfTarget.toFixed(0)}%
      </span>
      <VerdictIcon className={`size-3.5 ${verdictColor}`} />
    </div>
  );
}