export interface Plant {
  id: string;
  name: string;
  strain: string | null;
  roomId: string | null;
  batchId: string | null;
  wetWeight: number | null;
  dryTarget: number | null;
  currentWeight: number | null;
  containerGallons: number | null;
  notes: string | null;
  startDate: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  stage: string | null;
  mirrorPlantId: string | null;
}

export interface DryBackLog {
  id: number;
  timestamp: Date;
  currentWeightLbs: number;
  dryBackPercent: number;
  watered: boolean;
  fed: boolean;
  trainingEvent: string | null;
  notes: string | null;
  source: string;
  plantId: string | null;
  batchId: string | null;
  containerGallons: number;
  wetWeightLbs: number;
  dryTargetWeightLbs: number;
  runoffEc: number | null;
  unit: string;
  createdAt: Date;
  userId: string;
}

export interface IrrigationEvent {
  id: number;
  timestamp: Date;
  moisturePercentage: number | null;
  notes: string | null;
  roomId: string;
  zoneId: string;
  sensorMac: string | null;
  ecLevel: number | null;
  isManualEntry: boolean;
  userId: string;
  importId: number | null;
  batchId: string | null;
  plantId: string | null;
  currentWeightLbs: number | null;
}

export interface PlantInsight {
  id: string;
  createdAt: Date;
  date: Date;
  recommendationType: string;
  recommendationText: string;
  actionPlan: string | null;
  plantId: string;
  lastBriefingAt: Date;
  overnightWeightLoss: number | null;
  overnightVpdAvg: number | null;
  overnightMoistureStart: number | null;
  overnightMoistureEnd: number | null;
  outcome: string | null;
  outcomeNotes: string | null;
}

export interface PlantWithDetails extends Omit<Plant, 'dryBackLogs' | 'irrigationEvents' | 'plantInsights'> {
  room: { id: string; name: string } | null;
  batch: { id: string; name: string } | null;
  dryBackLogs: DryBackLog[];
  irrigationEvents: IrrigationEvent[];
  plantInsights: PlantInsight[];
  mirrorPlant: { id: string; name: string } | null;
}

// Type guard to check if event is a DryBackLog
export function isDryBackLog(event: DryBackLog | IrrigationEvent): event is DryBackLog {
  return 'currentWeightLbs' in event && 'dryBackPercent' in event;
}
