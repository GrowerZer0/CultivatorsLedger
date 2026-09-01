import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plants = await db.plant.findMany({
      where: { userId },
      select: { 
        id: true, 
        name: true,
        currentWeight: true,
        strain: true,
        roomId: true,
        batchId: true
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(plants);
  } catch (error) {
    console.error("Error fetching plants:", error);
    return NextResponse.json(
      { error: "Failed to fetch plants" }, 
      { status: 500 }
    );
  }
}
