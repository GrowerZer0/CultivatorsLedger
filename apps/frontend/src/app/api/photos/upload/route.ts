import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

function computeWeekOfStage(
  stage: string | null,
  startDate: Date,
  flipDate: Date | null
): number | null {
  if (!stage) return null;
  if (stage === "flowering" && flipDate) {
    const daysSinceFlip = Math.floor(
      (Date.now() - new Date(flipDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.floor(daysSinceFlip / 7) + 1;
  }
  if (stage === "vegetative") {
    const daysSinceStart = Math.floor(
      (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.floor(daysSinceStart / 7) + 1;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const plantId = formData.get("plantId") as string | null;
    const note = (formData.get("note") as string | null) || null;

    // Validate inputs BEFORE touching file.*
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!plantId) {
      return NextResponse.json({ error: "No plant ID provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPEG, PNG, WebP, or HEIC." },
        { status: 400 }
      );
    }

    // Verify the plant belongs to this user
    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      select: {
        id: true,
        stage: true,
        startDate: true,
        flipDate: true,
        currentWeight: true,
        roomId: true,
      },
    });
    if (!plant) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }

    // Build storage path and buffer BEFORE calling upload
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `${userId}/${plantId}/${timestamp}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: uploadError } = await adminClient.storage
      .from("plant-photos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
    }

    // Create the DB row
    const weekOfStage = computeWeekOfStage(
      plant.stage,
      new Date(plant.startDate),
      plant.flipDate ? new Date(plant.flipDate) : null
    );

    const photo = await db.plantPhoto.create({
      data: {
        plantId,
        userId,
        storagePath,
        note: note ? note.slice(0, 200) : null,
        stageAtCapture: plant.stage,
        weekOfStage,
        weightAtCapture: plant.currentWeight,
        roomId: plant.roomId,
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      photo: {
        id: photo.id,
        storagePath: photo.storagePath,
        note: photo.note,
        capturedAt: photo.capturedAt,
      },
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}