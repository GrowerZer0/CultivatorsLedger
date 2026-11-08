/**
 * Substrate nutrient banks.
 *
 * These are NOT lab-measured values. They are calibrated heuristics based
 * on:
 *   - Manufacturer guaranteed analysis (FoxFarm publishes NPK + Ca)
 *   - Grower consensus on release window (Happy Frog: 3-4 weeks)
 *   - The assumption that a 5-gal pot of pre-charged soil can carry a
 *     vegging plant at published NPK targets for roughly `releaseWeeks`.
 *
 * The conversion factor below is chosen so that at week 0 of a 5-gal
 * Happy Frog pot, the substrate contributes ~100% of the target
 * vegetative N. It decays linearly to 0 by `releaseWeeks`.
 *
 * Everything in this file is a MODEL, not a measurement. It will be wrong
 * for some grows. The UI must disclose that. Phase C will tighten it via
 * user-reported outcomes.
 */

export interface SubstrateProfile {
  id: string;
  label: string;
  /** Guaranteed analysis from the manufacturer's label, percentages by weight */
  guaranteedPct: { N: number; P: number; K: number; Ca: number; Mg?: number };
  /** Weeks before the amendment is exhausted. 0 = inert substrate. */
  releaseWeeks: number;
  /** For the user — why this profile exists, where the numbers came from. */
  notes: string;
}

export const SUBSTRATE_PROFILES: Record<string, SubstrateProfile> = {
  happy_frog: {
    id: "happy_frog",
    label: "Fox Farm Happy Frog (soil)",
    guaranteedPct: { N: 0.30, P: 0.30, K: 0.05, Ca: 1.00 },
    releaseWeeks: 4,
    notes:
      "Amended organic soil. Label NPK 0.30-0.30-0.05 + 1.0% Ca. Release " +
      "is biological — 3-4 weeks of native nutrition before amendments " +
      "are exhausted. No N needed until ~week 4.",
  },
  ocean_forest: {
    id: "ocean_forest",
    label: "Fox Farm Ocean Forest (soil)",
    guaranteedPct: { N: 0.30, P: 0.45, K: 0.05, Ca: 1.00 },
    releaseWeeks: 5,
    notes:
      "Hotter than Happy Frog. Label NPK 0.30-0.45-0.05 + 1.0% Ca. " +
      "Commonly cited as 4-6 weeks before fade.",
  },
  coco_perlite: {
    id: "coco_perlite",
    label: "Coco/Perlite (inert)",
    guaranteedPct: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 },
    releaseWeeks: 0,
    notes:
      "Inert substrate. All nutrients must come from feed. Calcium and " +
      "magnesium are particularly important — coco tends to bind Ca/Mg.",
  },
  coco_perlite_vermiculite: {
    id: "coco_perlite_vermiculite",
    label: "Coco/Perlite/Vermiculite mix (inert)",
    guaranteedPct: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 },
    releaseWeeks: 0,
    notes:
      "Inert. Vermiculite holds water and some cations but provides no " +
      "meaningful NPK. All nutrition comes from feed.",
  },
  peat_mix: {
    id: "peat_mix",
    label: "Peat-based mix (Pro-Mix HP or similar)",
    guaranteedPct: { N: 0.10, P: 0.05, K: 0.05, Ca: 0 },
    releaseWeeks: 2,
    notes:
      "Light starter amendment. Usually 1-2 weeks of native nutrition, " +
      "then depends on feed.",
  },
  starter_mix: {
    id: "starter_mix",
    label: "Seedling starter mix (plugs/trays)",
    guaranteedPct: { N: 0.05, P: 0.05, K: 0.05, Ca: 0 },
    releaseWeeks: 2,
    notes:
      "Very light starter charge. Seedlings need almost nothing early; " +
      "assume minimal contribution.",
  },
};

/**
 * Calibration constant: converts % by weight → mg/L at the baseline 5-gal pot.
 *
 * Derived as follows: a 5-gal pot of Happy Frog (0.30% N) is believed to
 * supply ~180 mg/L N for ~4 weeks at the target watering rate. Solving
 * 0.30% × factor × 1.0 = 180 gives factor ≈ 600.
 *
 * This is a heuristic. It only works when the pot volume is 5 gal and the
 * moisture content is at field capacity. See `computeSubstrateContribution`
 * for how pot size and week-into-grow adjust it.
 */
const MG_PER_L_PER_PCT_AT_5GAL = 600;

/**
 * Compute the substrate's contribution to a specific element at a specific
 * point in the grow.
 *
 * @param profile Substrate profile from SUBSTRATE_PROFILES
 * @param element Which element to compute (N, P, K, Ca, Mg)
 * @param weekIntoGrow Weeks since transplant / substrate started
 * @param containerGallons Pot size in gallons (5 = baseline; smaller pots provide proportionally less)
 */
export function computeSubstrateContribution(
  profile: SubstrateProfile,
  element: "N" | "P" | "K" | "Ca" | "Mg",
  weekIntoGrow: number,
  containerGallons: number,
): number {
  if (profile.releaseWeeks === 0) return 0;

  const guaranteedPct = profile.guaranteedPct[element] ?? 0;
  if (guaranteedPct === 0) return 0;

  // Linear decay: full at week 0, zero at releaseWeeks
  const decayFactor = Math.max(0, 1 - weekIntoGrow / profile.releaseWeeks);
  if (decayFactor === 0) return 0;

  // Pot-size scaling: 5-gal baseline, linear
  const sizeFactor = containerGallons / 5.0;

  return guaranteedPct * MG_PER_L_PER_PCT_AT_5GAL * decayFactor * sizeFactor;
}