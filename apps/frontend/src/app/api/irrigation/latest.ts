// src/app/api/irrigation/latest.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const latest = await db.irrigationEvent.findFirst({
      orderBy: { timestamp: "desc" },
    });

    if (!latest) {
      return NextResponse.json(
        { error: "No irrigation data found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: latest.id,
      timestamp: latest.timestamp.toISOString(),
      moisturePercent: Number(latest.moisturePercentage),
      ec: latest.ecLevel ? Number(latest.ecLevel) : null,
      roomId: latest.roomId,
      zoneId: latest.zoneId,
      isManualEntry: latest.isManualEntry,
    });
  } catch (error) {
    console.error("Error fetching latest irrigation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}