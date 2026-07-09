// apps/frontend/src/app/api/import/csv/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

// Helper to parse timestamps
function parseTimestamp(value: string): Date | null {
  if (!value || value.trim() === "") return null;
  const cleaned = value.trim();
  let d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  const normalized = cleaned.replace(/\//g, "-");
  d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  const parts = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (parts) {
    const [, m, dd, yyyy, hh, mm, ss] = parts;
    d = new Date(parseInt(yyyy), parseInt(m)-1, parseInt(dd), parseInt(hh), parseInt(mm), parseInt(ss));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mappingRaw = formData.get("mapping") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let mapping: {
      timestampCol: string;
      temperatureCol: string;
      humidityCol: string;
      roomIdCol?: string;
      zoneIdCol?: string;
    };

    try {
      mapping = JSON.parse(mappingRaw || "{}");
    } catch {
      return NextResponse.json({ error: "Invalid mapping configuration" }, { status: 400 });
    }

    const { timestampCol, temperatureCol, humidityCol, roomIdCol, zoneIdCol } = mapping;

    if (!timestampCol || !temperatureCol || !humidityCol) {
      return NextResponse.json(
        { error: "Mapping must include timestampCol, temperatureCol, and humidityCol" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    if (lines.length < 2) {
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 });
    }

    const headers = lines[0].split(",").map((h) => h.trim());

    const timestampIdx = headers.indexOf(timestampCol);
    const tempIdx = headers.indexOf(temperatureCol);
    const humidityIdx = headers.indexOf(humidityCol);
    const roomIdx = roomIdCol ? headers.indexOf(roomIdCol) : -1;
    const zoneIdx = zoneIdCol ? headers.indexOf(zoneIdCol) : -1;

    if (timestampIdx === -1 || tempIdx === -1 || humidityIdx === -1) {
      return NextResponse.json(
        { error: `One or more mapped columns not found in CSV. Available: ${headers.join(", ")}` },
        { status: 400 }
      );
    }

    const records = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < Math.max(timestampIdx, tempIdx, humidityIdx, roomIdx, zoneIdx) + 1) {
        errors.push(`Row ${i}: Skipped due to insufficient columns`);
        continue;
      }

      const rawTimestamp = values[timestampIdx];
      const rawTemp = values[tempIdx];
      const rawHumidity = values[humidityIdx];
      const rawRoom = roomIdx !== -1 ? values[roomIdx] : null;
      const rawZone = zoneIdx !== -1 ? values[zoneIdx] : null;

      if (rawTimestamp === "" || rawTemp === "" || rawHumidity === "") {
        errors.push(`Row ${i}: Skipped due to missing required data`);
        continue;
      }

      const timestamp = parseTimestamp(rawTimestamp);
      if (!timestamp) {
        errors.push(`Row ${i}: Invalid timestamp "${rawTimestamp}"`);
        continue;
      }

      let temp = parseFloat(rawTemp);
      let humidity = parseFloat(rawHumidity);
      if (temp > 50) {
        temp = (temp - 32) * 5 / 9;
      }
      if (isNaN(temp) || isNaN(humidity)) {
        errors.push(`Row ${i}: Invalid temperature or humidity values`);
        continue;
      }

      records.push({
        airTempC: Math.round(temp * 10) / 10,
        relativeHumidity: Math.round(humidity * 10) / 10,
        timestamp: timestamp,
        roomId: rawRoom && rawRoom !== "-" ? rawRoom : "CSV Import",
        zoneId: rawZone && rawZone !== "-" ? rawZone : "Main",
        isManualEntry: true,
        leafOffsetC: 2.0,
        userId: userId,
      });
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: `No valid records found. ${errors.length > 0 ? errors.slice(0, 3).join("; ") : ""}` },
        { status: 400 }
      );
    }

    const result = await db.climateLog.createMany({
      data: records,
      skipDuplicates: true,
    });

    await db.importHistory.create({
      data: {
        filename: file.name,
        rowsImported: result.count,
        importStatus: "completed",
        userId: userId,
      },
    });

    revalidatePath("/");

    return NextResponse.json({
      success: true,
      imported: result.count,
      total: records.length,
      skipped: errors.length,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}