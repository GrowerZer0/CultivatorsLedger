export type MeasurementSource = {
  type: 'manual' | 'csv_import' | 'esp32' | 'sensor' | 'api';
  device?: string;
  importId?: string;
  metadata?: Record<string, any>;
};

export type BaseMeasurement = {
  id: string;
  timestamp: Date;
  source: MeasurementSource;
  plantId?: string | null;
  roomId?: string | null;
  batchId?: string | null;
  userId: string;
};

export type WeightMeasurement = BaseMeasurement & {
  type: 'weight';
  value: number;
  unit: 'lbs' | 'kg' | 'g';
  wetWeight?: number;
  dryTarget?: number;
  dryBackPercent?: number;
};

export type ClimateMeasurement = BaseMeasurement & {
  type: 'climate';
  temperatureC: number;
  relativeHumidity: number;
  vpd?: number;
  leafOffsetC?: number;
};

export function getSourceConfidence(source: MeasurementSource): 'high' | 'medium' | 'low' | 'unknown' {
  switch (source.type) {
    case 'esp32':
    case 'sensor':
      return 'high';
    case 'manual':
      return 'medium';
    case 'csv_import':
      return source.metadata?.isVerified ? 'high' : 'medium';
    case 'api':
      return 'low';
    default:
      return 'unknown';
  }
}