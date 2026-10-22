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
      const weight = body.weight || body.currentWeight || body.weightLbs;
      
      if (weight === undefined || weight === null || isNaN(weight)) {
        return NextResponse.json({ error: 'Invalid weight value' }, { status: 400 });
      }

      // Find which plant this sensor is associated with
      let plant = null;
      
      // Try to find plant by name matching sensor name
      const plantName = sensor.name.replace(/ load cell/i, '').replace(/ sensor/i, '').trim();
      if (plantName) {
        plant = await db.plant.findFirst({
          where: { 
            name: { contains: plantName, mode: 'insensitive' },
            userId: sensor.userId,
          },
        });
      }

      // If no plant found, try to find any plant
      if (!plant) {
        const plants = await db.plant.findMany({
          where: { userId: sensor.userId },
          take: 1,
        });
        if (plants.length > 0) {
          plant = plants[0];
        }
      }

      if (!plant) {
        // No plant found - create a default plant
        plant = await db.plant.create({
          data: {
            name: `Plant from ${sensor.name}`,
            userId: sensor.userId,
          },
        });
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

      // === WET WEIGHT SOURCE PRIORITY ===
      // 1. plant.wetWeight (source of truth — set by user via "Set FC" button)
      // 2. ESP32 payload fieldCapacity_g (bootstrap only)
      // 3. Latest log's wetWeightLbs
      // 4. Fall back to current weight (last resort)

      let wetWeight = 0;
      let dryTarget = 0;

      if (plant.wetWeight !== null && plant.wetWeight !== undefined && Number(plant.wetWeight) > 0) {
        wetWeight = Number(plant.wetWeight);
        dryTarget = Number(plant.dryTarget) || 0;
      } else {
        // Bootstrap: read from ESP32 payload
        const payloadFieldCapacityG = body.fieldCapacity_g;
        if (payloadFieldCapacityG && payloadFieldCapacityG > 50) {
          wetWeight = payloadFieldCapacityG / 453.592;
        } else if (latestLog) {
          wetWeight = Number(latestLog.wetWeightLbs) || 0;
          dryTarget = Number(latestLog.dryTargetWeightLbs) || 0;
        }
        if (wetWeight === 0) {
          wetWeight = weight; // last resort — this reading becomes the WW
        }
      }
      
      if (wetWeight === 0 && latestLog) {
        wetWeight = Number(latestLog.wetWeightLbs) || 0;
        dryTarget = Number(latestLog.dryTargetWeightLbs) || 0;
      }

      // Calculate dryback percent FROM WET WEIGHT (the correct model for this setup)
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
        where: { userId: sensor.userId },
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
