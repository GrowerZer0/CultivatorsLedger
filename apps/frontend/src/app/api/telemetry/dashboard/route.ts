import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function computeVPD(tempC: number, rh: number): number {
  const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const ea = (rh / 100) * es;
  return Math.round((es - ea) * 100) / 100;
}

export async function GET() {
  try {
    const [latestClimate, latestIrrigation, latestBatch] = await Promise.all([
      db.climateLog.findFirst({ orderBy: { timestamp: "desc" } }),
      db.irrigationEvent.findFirst({ orderBy: { timestamp: "desc" } }),
      db.batchHarvest.findFirst({ orderBy: { startDate: "desc" } }),
    ]);

    const climate = latestClimate ? {
      temperature: Number(latestClimate.airTempC),
      temperatureF: Number(latestClimate.airTempC) * 9/5 + 32,
      humidity: Number(latestClimate.relativeHumidity),
      vpd: latestClimate.calculatedVpdKpa 
        ? Number(latestClimate.calculatedVpdKpa) 
        : computeVPD(Number(latestClimate.airTempC), Number(latestClimate.relativeHumidity)),
      timestamp: latestClimate.timestamp.toISOString(),
      isManual: latestClimate.isManualEntry,
    } : null;

    const irrigation = latestIrrigation ? {
      moisturePercent: Number(latestIrrigation.moisturePercentage),
      ec: latestIrrigation.ecLevel ? Number(latestIrrigation.ecLevel) : null,
      timestamp: latestIrrigation.timestamp.toISOString(),
      isManual: latestIrrigation.isManualEntry,
    } : null;

    const batch = latestBatch ? {
      strainName: latestBatch.strainName,
      startDate: latestBatch.startDate.toISOString(),
      harvestDate: latestBatch.harvestDate?.toISOString() || null,
      totalYield: latestBatch.totalDryYieldG ? Number(latestBatch.totalDryYieldG) : null,
    } : null;

    return NextResponse.json({ climate, irrigation, batch });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}