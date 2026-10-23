"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export interface ClimateReading {
  temperatureC: number;
  temperatureF: number;
  humidity: number;
  vpd: number;
  timestamp: string;
  roomName: string | null;
}

export interface ClimatePoint {
  time: string;
  vpd: number;
  tempF: number;
  rh: number;
}

function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  return Math.round(Math.max(0, es - ea) * 100) / 100;
}

export async function getLatestClimateReading(): Promise<ClimateReading | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const log = await db.climateLog.findFirst({
    where: { userId },
    orderBy: { timestamp: "desc" },
    include: { room: true },
  });

  if (!log) return null;

  const tempC = Number(log.airTempC);
  const rh = Number(log.relativeHumidity);
  const vpd = log.calculatedVpdKpa ? Number(log.calculatedVpdKpa) : computeVPD(tempC, rh);

  return {
    temperatureC: tempC,
    temperatureF: (tempC * 9) / 5 + 32,
    humidity: rh,
    vpd,
    timestamp: log.timestamp.toISOString(),
    roomName: log.room?.name || null,
  };
}

export async function getClimateTrend(hours = 24): Promise<ClimatePoint[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const logs = await db.climateLog.findMany({
    where: { userId, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
  });

  return logs.map((log) => {
    const tempC = Number(log.airTempC);
    const rh = Number(log.relativeHumidity);
    const vpd = log.calculatedVpdKpa
      ? Number(log.calculatedVpdKpa)
      : computeVPD(tempC, rh);
    return {
      time: new Date(log.timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      vpd,
      tempF: (tempC * 9) / 5 + 32,
      rh,
    };
  });
}