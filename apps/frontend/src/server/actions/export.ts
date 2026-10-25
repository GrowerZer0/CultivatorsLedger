"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { canAccessFeature } from "@/lib/features";

const CSV_NEWLINE = "\r\n"; // Excel-friendly

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((r) => r.map(escapeCsvField).join(",")),
  ];
  return lines.join(CSV_NEWLINE) + CSV_NEWLINE;
}

const HEADERS = [
  "timestamp",
  "plant_name",
  "kind",
  "weight_lbs",
  "dryback_percent",
  "temperature_c",
  "temperature_f",
  "humidity",
  "vpd_kpa",
  "notes",
  "source",
] as const;

type ExportRow = {
  timestamp: Date;
  plantName: string;
  kind: "weight" | "climate" | "irrigation";
  weightLbs?: number | null;
  drybackPercent?: number | null;
  temperatureC?: number | null;
  temperatureF?: number | null;
  humidity?: number | null;
  vpdKpa?: number | null;
  notes?: string | null;
  source?: string | null;
};

async function buildRows(
  userId: string,
  filter?: { plantId?: string; roomId?: string | null },
): Promise<ExportRow[]> {
  // Pull plants once for name lookup and (optional) filter
  const plants = await db.plant.findMany({
    where: filter?.plantId
      ? { userId, id: filter.plantId }
      : { userId },
    select: { id: true, name: true, roomId: true },
  });

  if (plants.length === 0) return [];

  const plantIds = plants.map((p) => p.id);
  const plantNameById = new Map(plants.map((p) => [p.id, p.name]));
  const roomIds = Array.from(
    new Set(plants.map((p) => p.roomId).filter((r): r is string => !!r)),
  );

  const [weights, irrigations, climates] = await Promise.all([
    db.dryBackLog.findMany({
      where: { userId, plantId: { in: plantIds } },
      orderBy: { timestamp: "asc" },
    }),
    db.irrigationEvent.findMany({
      where: { userId, plantId: { in: plantIds } },
      orderBy: { timestamp: "asc" },
    }),
    roomIds.length > 0
      ? db.climateLog.findMany({
          where: { userId, roomId: { in: roomIds } },
          orderBy: { timestamp: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const rows: ExportRow[] = [];

  for (const w of weights) {
    rows.push({
      timestamp: w.timestamp,
      plantName: (w.plantId && plantNameById.get(w.plantId)) || "",
      kind: "weight",
      weightLbs: w.currentWeightLbs !== null ? Number(w.currentWeightLbs) : null,
      drybackPercent:
        w.dryBackPercent !== null ? Number(w.dryBackPercent) : null,
      notes: w.notes ?? null,
      source: w.source ?? null,
    });
  }

  for (const i of irrigations) {
    rows.push({
      timestamp: i.timestamp,
      plantName: (i.plantId && plantNameById.get(i.plantId)) || "",
      kind: "irrigation",
      weightLbs:
        i.currentWeightLbs !== null ? Number(i.currentWeightLbs) : null,
      notes: i.notes ?? null,
      source: i.source ?? null,
    });
  }

  // Climate is per-room, not per-plant. Attribute to the plant's room where possible.
  const roomNameHint = new Map<string, string>();
  for (const p of plants) {
    if (p.roomId) roomNameHint.set(p.roomId, p.name);
  }
  for (const c of climates) {
    const tempC = Number(c.airTempC);
    rows.push({
      timestamp: c.timestamp,
      plantName: roomNameHint.get(c.roomId) || "",
      kind: "climate",
      temperatureC: tempC,
      temperatureF: (tempC * 9) / 5 + 32,
      humidity: Number(c.relativeHumidity),
      vpdKpa: c.calculatedVpdKpa ? Number(c.calculatedVpdKpa) : null,
      source: c.sourceType ?? null,
    });
  }

  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return rows;
}

function rowsToCsv(rows: ExportRow[]): string {
  return toCsv(
    [...HEADERS],
    rows.map((r) => [
      r.timestamp.toISOString(),
      r.plantName,
      r.kind,
      r.weightLbs ?? "",
      r.drybackPercent ?? "",
      r.temperatureC ?? "",
      r.temperatureF ?? "",
      r.humidity ?? "",
      r.vpdKpa ?? "",
      r.notes ?? "",
      r.source ?? "",
    ]),
  );
}

export async function exportPlantCSV(plantId: string): Promise<
  | { success: true; filename: string; csv: string }
  | { success: false; error: string }
> {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    const allowed = await canAccessFeature("export_csv", userId);
    if (!allowed) {
      return {
        success: false,
        error: "CSV export requires a Grower subscription.",
      };
    }

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      select: { name: true },
    });
    if (!plant) return { success: false, error: "Plant not found" };

    const rows = await buildRows(userId, { plantId });
    const csv = rowsToCsv(rows);

    const safeName = plant.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    return { success: true, filename: `${safeName}-export-${date}.csv`, csv };
  } catch (err) {
    console.error("exportPlantCSV error:", err);
    return { success: false, error: "Failed to export plant data." };
  }
}

export async function exportAllCSV(): Promise<
  | { success: true; filename: string; csv: string }
  | { success: false; error: string }
> {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    const allowed = await canAccessFeature("export_csv", userId);
    if (!allowed) {
      return {
        success: false,
        error: "CSV export requires a Grower subscription.",
      };
    }

    const rows = await buildRows(userId);
    const csv = rowsToCsv(rows);
    const date = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      filename: `cultivators-ledger-export-${date}.csv`,
      csv,
    };
  } catch (err) {
    console.error("exportAllCSV error:", err);
    return { success: false, error: "Failed to export data." };
  }
}