// 1. DATA TYPE DEFINITIONS (UI-Synced) - UPDATED
export type DryBackLog = {
  id: string;
  cultivar: string;
  containerGallons: number;
  wetWeight: number;
  dryTarget: number;
  weight: number;
  runoff_ec?: number;
  loggedAt: string;
  source?: string; 
};

export type NutrientDose = {
  product: string;
  mlPerGallon: number;
};

export type FeedSchedule = {
  id: string;
  brand: string;
  stage: "seedling" | "vegetative" | "transition" | "flower" | "finish";
  label: string;
  targetEc: number;
  targetPh: number;
  doses: NutrientDose[];
};

export type ReservoirInput = {
  reservoirGallons: number;
  leftoverGallons: number;
  doses: NutrientDose[];
  currentEc?: number;
  targetEc?: number; 
};

export type ReservoirDelta = {
  topOffGallons: number;
  waterPercentToAdd: number;
  nutrientsToAdd: Array<NutrientDose & { totalMl: number }>;
  adjustedTopOffEc: number;
  alerts: string[];          // 👈 Added Layer 3 Track
  isCriticalClamp: boolean;   // 👈 Added Layer 3 Track
};

export type EnvironmentReading = {
  id: string;
  recordedAt: string;
  temperatureF: number;
  humidity: number;
  vpd: number;
};

// 2. CROP PHASE TARGET DATA MAPS (Restored & Enhanced)
export const CROP_STAGE_TARGETS = {
  VEG: {
    targetVpdMin: 0.8,
    targetVpdMax: 1.1,
    maxDryBack: 15
  },
  FLOWER: {
    targetVpdMin: 1.2,
    targetVpdMax: 1.5,
    maxDryBack: 30
  }
};

// 3. RESTORED THERMODYNAMIC THERMAL-COUPLE EQUATIONS
export function calculateLeafVPD(tempF: number, rh: number, offsetF: number = -2): number {
  const tempC = ((tempF - 32) * 5) / 9;
  const leafTempC = tempC + (offsetF * 5) / 9;
  
  const esLeaf = 0.61078 * Math.exp((17.27 * leafTempC) / (leafTempC + 237.3));
  const esAir = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const eaAir = esAir * (rh / 100);
  
  const vpd = esLeaf - eaAir;
  return vpd < 0 ? 0 : parseFloat(vpd.toFixed(3));
}

export function getVpdStatus(stage: 'VEG' | 'FLOWER', currentVpd: number): 'LOW' | 'IDEAL' | 'HIGH' {
  const targets = CROP_STAGE_TARGETS[stage];
  if (currentVpd < targets.targetVpdMin) return 'LOW';
  if (currentVpd > targets.targetVpdMax) return 'HIGH';
  return 'IDEAL';
}

// 4. PERSISTENT CROP-STEERING CALCULATORS WITH BIOLOGICAL GUARDRAILS
export function calculateDryBack(log: DryBackLog) {
  const totalDrop = Math.max(log.wetWeight - log.dryTarget, 0.01);
  const currentDrop = Math.max(log.wetWeight - log.weight, 0);
  
  let rawDryBackPercent = (currentDrop / totalDrop) * 100;
  const alerts: string[] = [];
  
  // ⚠️ Layer 3 Biological Anomalies Checks
  if (rawDryBackPercent > 100) {
    alerts.push("Substrate desiccation risk: Pot weight dropped below target wilting threshold.");
  }
  if (log.weight > log.wetWeight) {
    alerts.push("Data collection mismatch: Measured mass exceeds saturation limits.");
  }

  const dryBackPercent = Math.max(0, Math.min(rawDryBackPercent, 100));
  const poundsUntilIrrigation = Math.max(log.weight - log.dryTarget, 0);
  const estimatedHoursUntilWater = Math.round(poundsUntilIrrigation / 0.18);

  return {
    dryBackPercent,
    poundsUntilIrrigation,
    estimatedHoursUntilWater,
    alerts,
    isClamped: rawDryBackPercent > 100 || log.weight > log.wetWeight
  };
}

export function calculateTriggerWeight(satWt: number, dbCoeff: number): number {
  if (satWt <= 0 || dbCoeff < 0 || dbCoeff > 1) return 0;
  return parseFloat((satWt * (1 - dbCoeff)).toFixed(2));
}

// 5. RE-ENGINEERED DILUTION ELEMENT ENGINE WITH CONCENTRATE TOXICITY INTERCEPTORS
export function calculateReservoirDelta(input: ReservoirInput): ReservoirDelta {
  const reservoirGallons = Math.max(input.reservoirGallons, 0);
  const leftoverGallons = Math.min(Math.max(input.leftoverGallons, 0), reservoirGallons);
  const topOffGallons = Number((reservoirGallons - leftoverGallons).toFixed(2));
  
  const currentEc = input.currentEc ?? 0;
  const targetEc = input.targetEc ?? 0;

  let multiplier = 1.0;
  const alerts: string[] = [];
  let isCriticalClamp = false;

  if (topOffGallons > 0 && reservoirGallons > 0 && currentEc > 0 && targetEc > 0) {
    const totalTargetIons = reservoirGallons * targetEc;
    const currentResidualIons = leftoverGallons * currentEc;
    const requiredTopOffIons = Math.max(totalTargetIons - currentResidualIons, 0);
    
    const theoreticalStraightTopOffIons = topOffGallons * targetEc;
    multiplier = requiredTopOffIons / theoreticalStraightTopOffIons;
  }

  let theoreticalEcOutput = targetEc * multiplier;

  // ⚠️ Osmotic Shock Interceptor Clamping Loop
  if (theoreticalEcOutput > 3.5) {
    multiplier = 3.5 / targetEc; 
    theoreticalEcOutput = 3.5;
    isCriticalClamp = true;
    alerts.push("Osmotic shock lock: Top-off EC clamped at 3.5 to prevent fertilizer root burn.");
  }
  
  if (theoreticalEcOutput < 0.2 && currentEc > targetEc) {
    alerts.push("Excessive baseline salts: Residual tank EC is already above target thresholds. Fill with pure water.");
  }

  const adjustedTopOffEc = Number((theoreticalEcOutput).toFixed(2));

  return {
    topOffGallons,
    waterPercentToAdd: reservoirGallons === 0 ? 0 : Number(((topOffGallons / reservoirGallons) * 100).toFixed(1)),
    nutrientsToAdd: input.doses.map((dose) => ({
      ...dose,
      totalMl: Number((dose.mlPerGallon * topOffGallons * multiplier).toFixed(2))
    })),
    adjustedTopOffEc,
    alerts,
    isCriticalClamp
  };
}

export function averageVpd(readings: EnvironmentReading[]) {
  if (readings.length === 0) return 0;
  return Number((readings.reduce((sum, reading) => sum + reading.vpd, 0) / readings.length).toFixed(2));
}

// 6. FACTORY PRESET FEED LIBRARY (Retained)
export const commercialFeedSchedules: FeedSchedule[] = [
  {
    id: "fox-farm-soil-veg",
    brand: "Fox Farm",
    stage: "vegetative",
    label: "Soil Trio - Vegetative",
    targetEc: 1.35,
    targetPh: 6.4,
    doses: [
      { product: "Grow Big", mlPerGallon: 10 },
      { product: "Big Bloom", mlPerGallon: 15 }
    ]
  },
  {
    id: "fox-farm-soil-flower",
    brand: "Fox Farm",
    stage: "flower",
    label: "Soil Trio - Flower",
    targetEc: 1.85,
    targetPh: 6.45,
    doses: [
      { product: "Tiger Bloom", mlPerGallon: 10 },
      { product: "Big Bloom", mlPerGallon: 15 },
      { product: "Grow Big", mlPerGallon: 5 }
    ]
  },
  {
    id: "jacks-321-veg",
    brand: "Jacks",
    stage: "vegetative",
    label: "3-2-1 Base - Vegetative",
    targetEc: 1.55,
    targetPh: 5.9,
    doses: [
      { product: "Part A", mlPerGallon: 3.6 },
      { product: "Calcium Nitrate", mlPerGallon: 2.4 },
      { product: "Epsom Salt", mlPerGallon: 1.2 }
    ]
  },
  {
    id: "athena-blended-flower",
    brand: "Athena",
    stage: "flower",
    label: "Blended Line - Flower",
    targetEc: 2.1,
    targetPh: 5.85,
    doses: [
      { product: "Bloom A", mlPerGallon: 13 },
      { product: "Bloom B", mlPerGallon: 13 },
      { product: "Cleanse", mlPerGallon: 2.5 }
    ]
  }
];