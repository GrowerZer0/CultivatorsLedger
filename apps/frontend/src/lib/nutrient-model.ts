/**
 * Published macronutrient targets for cannabis in mg/L (ppm) of feed solution.
 *
 * Sources:
 * - Saloner & Bernstein (2020, 2024) — hydroponic N/P/K optimum studies
 * - Lefsrud lab (McGill) — Mg target ranges
 * - Practitioner consensus for flowering transition (less studied)
 *
 * These are TARGETS FOR WHAT THE PLANT NEEDS, not what a commercial feed
 * chart happens to provide. Substrate contribution is NOT subtracted here
 */

export interface NutrientTarget {
  N: number;
  P: number;
  K: number;
  Ca: number;
  Mg: number;
}

export interface NutrientStage {
  label: string;
  targets: NutrientTarget;
  notes: string;
}

export const NUTRIENT_TARGETS: Record<string, NutrientStage> = {
  seedling: {
    label: "Seedling",
    targets: { N: 100, P: 30, K: 60, Ca: 100, Mg: 40 },
    notes:
      "Half-strength veg. Seedlings have low demand — easy to overfeed. If the substrate is pre-charged soil, this is often already met.",
  },
  vegetative: {
    label: "Vegetative",
    targets: { N: 180, P: 30, K: 60, Ca: 150, Mg: 50 },
    notes:
      "Highest N demand of any stage. Saloner & Bernstein found 160–200 mg/L N optimum for vegetative cannabis. P and K stay low until flower.",
  },
  flowering: {
    label: "Flowering",
    targets: { N: 120, P: 50, K: 150, Ca: 150, Mg: 50 },
    notes:
      "N demand drops, P rises slightly, K demand more than doubles. This is where most feed charts get it right (high K) but many growers keep N too high, delaying flowering.",
  },
  dry: {
    label: "Dry",
    targets: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 },
    notes: "No feeding during dry. The plant is dead — only moisture matters.",
  },
  cure: {
    label: "Cure",
    targets: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 },
    notes: "No feeding during cure.",
  },
};

/**
 * Given a product's guaranteed analysis and a dose in mL/gal,
 * compute the mg/L of each element delivered.
 *
 * @param guaranteedPct - Label percentages like { N: 5, P: 0, K: 1 }
 * @param mlPerGallon - Dose in mL per gallon of water
 * @param densityGPerMl - Optional (default 1.0). Most liquid nutes are 1.0-1.2.
 */
export function computeSuppliedMgPerL(
  guaranteedPct: { N: number; P: number; K: number; Ca?: number; Mg?: number },
  mlPerGallon: number,
  densityGPerMl: number = 1.0,
): NutrientTarget {
  // 1 gallon = 3.785 L
  const LITERS_PER_GALLON = 3.785;
  // mass of product per liter of solution
  const gramsProductPerL = (mlPerGallon * densityGPerMl) / LITERS_PER_GALLON;
  // mg of product per liter
  const mgProductPerL = gramsProductPerL * 1000;

  // % label is mass of element per 100 g of product
  const mgElementPerL = (pct: number) => (mgProductPerL * pct) / 100;

  return {
    N: mgElementPerL(guaranteedPct.N),
    P: mgElementPerL(guaranteedPct.P),
    K: mgElementPerL(guaranteedPct.K),
    Ca: guaranteedPct.Ca !== undefined ? mgElementPerL(guaranteedPct.Ca) : 0,
    Mg: guaranteedPct.Mg !== undefined ? mgElementPerL(guaranteedPct.Mg) : 0,
  };
}

/**
 * Compare supplied to target and return a simple verdict for each element.
 */
export type NutrientVerdict = "low" | "in_range" | "high";

export interface ComparisonRow {
  element: keyof NutrientTarget;
  target: number;
  supplied: number;
  pctOfTarget: number; // supplied / target * 100
  verdict: NutrientVerdict;
}

export function compareToTargets(
  supplied: NutrientTarget,
  target: NutrientTarget,
): ComparisonRow[] {
  const elements: (keyof NutrientTarget)[] = ["N", "P", "K", "Ca", "Mg"];
  return elements.map((element) => {
    const t = target[element];
    const s = supplied[element];
    if (t === 0) {
      return {
        element,
        target: t,
        supplied: s,
        pctOfTarget: 0,
        verdict: "in_range", // ignore when target is 0
      };
    }
    const pct = (s / t) * 100;
    const verdict: NutrientVerdict =
      pct < 80 ? "low" : pct > 120 ? "high" : "in_range";
    return { element, target: t, supplied: s, pctOfTarget: pct, verdict };
  });
}