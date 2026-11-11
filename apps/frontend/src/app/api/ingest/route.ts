import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { revalidatePath } from 'next/cache';

// Helper to hash API keys
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
    }

    const hashed = hashKey(apiKey);
    const sensor = await db.sensorConfig.findFirst({
      where: { apiKeyHash: hashed, isActive: true },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Invalid or inactive sensor' }, { status: 401 });
    }

    // Update lastPingAt
    await db.sensorConfig.update({
      where: { id: sensor.id },
      data: { lastPingAt: new Date() },
    });

    // Handle empty or malformed body
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        // Ping request without data - just update lastPingAt
        return NextResponse.json({ 
          success: true, 
          type: 'ping',
          message: 'Ping received - no data provided' 
        });
      }
      body = JSON.parse(text);
      console.log('📥 INGEST PAYLOAD:', JSON.stringify(body));
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON payload',
        message: 'Please send valid JSON with weight data'
      }, { status: 400 });
    }
    
    // Check if this is WEIGHT data (from load cell) or ENVIRONMENTAL data
    const isWeightData = body.weight !== undefined || body.currentWeight !== undefined || body.weightLbs !== undefined;
    const isEnvironmentalData = body.temperature !== undefined || body.humidity !== undefined;

    // ==========================================
    // HANDLE WEIGHT DATA (ESP32 Load Cell)
    // ==========================================
    if (isWeightData) {
      let weight = body.weight || body.currentWeight || body.weightLbs;
      
      // 1. Convert grams to pounds if the unit is grams
      if (body.unit === "g") {
        weight = weight / 453.592;
      }
      
      if (weight === undefined || weight === null || isNaN(weight)) {
        return NextResponse.json({ error: 'Invalid weight value' }, { status: 400 });
      }

      // 2. Extract the field capacity from the payload (in grams or lbs)
      let payloadFieldCapacityLbs = null;
      if (body.fieldCapacity && body.fieldCapacity > 0) {
        // If the ESP32 sent grams, convert FC to pounds
        payloadFieldCapacityLbs = body.unit === "g" 
          ? body.fieldCapacity / 453.592 
          : body.fieldCapacity;
      }

      // Route the data based on the Sensor Name
      let plant = null;
      if (sensor.name.toLowerCase().includes("small")) {
        // Route to the newest plant that isn't finished
        plant = await db.plant.findFirst({
          where: { 
            userId: sensor.userId, 
            stage: { notIn: ["harvest", "dry", "cure"] } 
          },
          orderBy: { createdAt: "desc" }, // Get the newest plant
        });

      } else if (sensor.name.toLowerCase().includes("large") || sensor.name.toLowerCase().includes("load cell")) {
        // Route to the most recently updated pot-stage plant. Dry/cure are
        // excluded: those plants are hanging or jarred and cannot be on the
        // scale. If nothing matches, the reading is skipped below.
        plant = await db.plant.findFirst({
          where: { userId: sensor.userId, stage: { in: ["seedling", "vegetative", "flowering"] } },
          orderBy: { updatedAt: "desc" },
        });
      }

      // A weight reading only makes sense for a plant that is in a pot.
      // Dry/cure/archived plants are hanging or jarred and cannot be on a
      // load cell — a scale reading for one is either stale routing or a
      // lifted pot. Refuse to write rather than corrupt the plant's data.
      // Return 200 so the ESP32 does not retry-spam; the body says why.
      if (!plant) {
        return NextResponse.json(
          { success: true, skipped: "no pot-stage plant for this scale" },
          { status: 200 },
        );
      }

      // Get the latest log to calculate dryback percent
      const latestLog = await db.dryBackLog.findFirst({
        where: { plantId: plant.id },
        orderBy: { timestamp: "desc" },
      });

            // === IRRIGATION DETECTION ===
      // Detect weight jumps that indicate the pot was just watered.
      // Requires the elevated weight to be present (not a bounce), so we
      // compare against the previous reading and require the current weight
      // to be significantly higher.
      const IRRIGATION_THRESHOLD_LBS = 1.5;

      if (latestLog) {
        const previousWeight = Number(latestLog.currentWeightLbs);
        const weightJump = weight - previousWeight;

        if (weightJump > IRRIGATION_THRESHOLD_LBS) {
          // Check if we already logged an irrigation event in the last 5 minutes
          // (to avoid double-logging if the ESP32 sends multiple readings during watering)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const recentIrrigation = await db.irrigationEvent.findFirst({
            where: {
              plantId: plant.id,
              userId: sensor.userId,
              timestamp: { gte: fiveMinutesAgo },
              source: 'auto',
            },
          });

          if (!recentIrrigation) {
            await db.irrigationEvent.create({
              data: {
                timestamp: new Date(),
                roomId: plant.roomId || "Default",
                zoneId: "Main",
                plantId: plant.id,
                isManualEntry: false,
                userId: sensor.userId,
                notes: `Auto-detected: weight jumped ${weightJump.toFixed(2)} lbs (${previousWeight.toFixed(2)} → ${weight.toFixed(2)})`,
                source: 'auto',
                currentWeightLbs: weight,
              },
            });

            console.log(`💧 IRRIGATION DETECTED: ${plant.name} — jump of ${weightJump.toFixed(2)} lbs`);
          }
        }
      }

            // === AUTO-FC UPDATE LOGIC ===
      // Field capacity (wetWeight) is set ONLY by explicit user action
      // (Set FC button, scale modal, set-fc route, or check-in with
      // updateFieldCapacity). Ingest must never write wetWeight: a stable
      // reading cannot distinguish a saturated pot from a dry one, so any
      // heuristic here will eventually snap FC to the wrong value. The
      // pendingFcUpdate/pendingFcStartTime columns are now unused by
      // ingest; leave them in the schema until a separate cleanup.

            // === WET WEIGHT SOURCE PRIORITY ===
      // 1. plant.wetWeight (source of truth — set by user via "Set FC")
      // 2. Latest log's wetWeightLbs (historical fallback for pre-FC plants)
      // No last-resort fallback to the current reading: if we have never
      // been told what "saturated" weighs, we cannot compute a meaningful
      // dryback percent. Skip the calc rather than invent an FC.

      let wetWeight = 0;
      let dryTarget = 0;

      if (plant.wetWeight !== null && plant.wetWeight !== undefined && Number(plant.wetWeight) > 0) {
        wetWeight = Number(plant.wetWeight);
        dryTarget = Number(plant.dryTarget) || 0;
      } else if (latestLog) {
        wetWeight = Number(latestLog.wetWeightLbs) || 0;
        dryTarget = Number(latestLog.dryTargetWeightLbs) || 0;
      }

      // Calculate dryback percent FROM WET WEIGHT (the correct model for this setup)
      // If wetWeight is 0 the plant has no FC set; store dryBackPercent = 0
      // and let the UI show "Set FC" rather than a fabricated percentage.
      let dryBackPercent = 0;
      if (wetWeight > 0) {
        const lost = wetWeight - weight;
        dryBackPercent = Math.max(0, Math.min(100, (lost / wetWeight) * 100));
      }

      // Save the weight reading
      const dryTargetForLog = dryTarget || 0;
      const log = await db.dryBackLog.create({
        data: {
          timestamp: new Date(),
          currentWeightLbs: weight,
          plantId: plant.id,
          userId: sensor.userId,
          source: 'esp32',
          sourceDevice: sensor.name,
          containerGallons: Number(plant.containerGallons) || 3,
          wetWeightLbs: wetWeight,
          dryTargetWeightLbs: dryTarget,
          dryBackPercent: dryBackPercent,
          unit: 'lbs',
          notes: `Auto-logged from ${sensor.name}`,
        },
      });

      // Update the plant's current weight
      await db.plant.update({
        where: { id: plant.id },
        data: { currentWeight: weight },
      });

      revalidatePath("/");
      revalidatePath("/plants");
      revalidatePath("/dashboard");

      return NextResponse.json({
        success: true,
        type: 'weight',
        id: log.id,
        weight,
        plant: plant.name,
        dryBackPercent: dryBackPercent,
        message: 'Weight logged successfully',
      });
    }

    // ==========================================
    // HANDLE ENVIRONMENTAL DATA (Temperature/Humidity)
    // ==========================================
    if (isEnvironmentalData) {
      const { temperature, humidity } = body;
      
      if (temperature === undefined || humidity === undefined) {
        return NextResponse.json({ error: 'Missing temperature or humidity' }, { status: 400 });
      }

      const tempC = Number(temperature);
      const rh = Number(humidity);

      // Calculate VPD
      const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
      const ea = (rh / 100) * es;
      const vpd = Math.round(Math.max(0, es - ea) * 100) / 100;

      // Find a room for this user, or fall back to a default string
      const room = await db.room.findFirst({
        where: { userId: sensor.userId, deletedAt: null },
      });

      const log = await db.climateLog.create({
        data: {
          timestamp: new Date(),
          roomId: room?.id || "Default",
          zoneId: "Main",
          airTempC: tempC,
          relativeHumidity: rh,
          calculatedVpdKpa: vpd,
          isManualEntry: false,
          userId: sensor.userId,
          sourceType: 'sht45',
          sourceDevice: sensor.name,
        },
      });

      revalidatePath("/");
      revalidatePath("/dashboard");

      return NextResponse.json({
        success: true,
        type: 'environmental',
        id: log.id,
        temperature: tempC,
        humidity: rh,
        vpd: vpd,
        message: 'Environmental data logged successfully',
      });
    }

    // If neither weight nor environmental data
    return NextResponse.json({
      error: 'Unrecognized data format. Send weight, temperature, or humidity data.',
    }, { status: 400 });

  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
