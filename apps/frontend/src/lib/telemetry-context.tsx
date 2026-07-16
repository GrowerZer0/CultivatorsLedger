"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type TelemetryData = {
  activeDryBack?: {
    dryBackPercent: number;
    estimatedHoursUntilWater: number;
    poundsUntilIrrigation: number;
  };
  reservoirDelta?: {
    topOffGallons: number;
    waterPercentToAdd: number;
    nutrientsToAdd: { product: string; mlPerGallon: number; totalMl: number }[];
  };
  latestEnvironment?: {
    temperatureF: number;
    humidity: number;
    vpd: number;
  };
  latestRunoffEc?: number | null;
  dailyWaterUse?: number;
  trendInsights?: {
    drybackSpeed: { pct: number; direction: string } | null;
    uptakeTrend: { pct: number; direction: string } | null;
  } | null;
  recoveryStatus?: {
    phase: number;
    status: string;
    recommendation: string;
  } | null;
  leftoverGallons?: number;
  activeSchedule?: any; // you can pass the full FeedSchedule if needed
};

type TelemetryContextType = {
  data: TelemetryData;
  setData: (newData: Partial<TelemetryData>) => void;
};

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<TelemetryData>({});

  const setData = (newData: Partial<TelemetryData>) => {
    setDataState((prev) => ({ ...prev, ...newData }));
  };

  return (
    <TelemetryContext.Provider value={{ data, setData }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}