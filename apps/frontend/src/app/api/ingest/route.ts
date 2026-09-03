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

      let wetWeight = 0;
      let dryTarget = 0;
      
      if (latestLog) {
        wetWeight = Number(latestLog.wetWeightLbs) || 0;
        dryTarget = Number(latestLog.dryTargetWeightLbs) || 0;
      }

      // If this is a high weight (post-irrigation), update wet weight
      if (weight > 18 && wetWeight === 0) {
        wetWeight = weight;
        dryTarget = Math.round(wetWeight * 0.72 * 10) / 10;
      }

      // Calculate dryback percent
      let dryBackPercent = 0;
      if (wetWeight > 0 && dryTarget > 0) {
        const range = wetWeight - dryTarget;
        if (range > 0) {
          const lost = wetWeight - weight;
          dryBackPercent = Math.max(0, Math.min(100, (lost / range) * 100));
        }
      }

      // Save the weight reading
      const log = await db.dryBackLog.create({
        data: {
          timestamp: new Date(),
          currentWeightLbs: weight,
          plantId: plant.id,
          userId: sensor.userId,
          source: 'esp32',
          sourceDevice: sensor.name,
          containerGallons: Number(plant.containerGallons) || 5,
          wetWeightLbs: wetWeight || 18.4,
          dryTargetWeightLbs: dryTarget || 13.2,
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
      const { temperature, humidity, roomId, zoneId, sensorMac } = body;
      
      if (temperature === undefined || humidity === undefined) {
        return NextResponse.json({ error: 'Missing temperature or humidity' }, { status: 400 });
      }

      // Push to PGMQ for async processing
      const payload = {
        air_temp_c: temperature,
        relative_humidity: humidity,
        room_id: roomId || 'default',
        zone_id: zoneId || 'Main',
        sensor_mac: sensorMac || 'unknown',
        timestamp: new Date().toISOString(),
        leaf_offset_c: 2.0,
        sensor_id: sensor.id,
        user_id: sensor.userId,
      };

      await db.$executeRaw`
        SELECT pgmq.send('sensor_pings', ${JSON.stringify(payload)}::jsonb)
      `;

      return NextResponse.json({
        success: true,
        type: 'environmental',
        message: 'Environmental data queued for processing',
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
