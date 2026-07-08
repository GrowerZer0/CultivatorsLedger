import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

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

    const body = await request.json();
    const { temperature, humidity, roomId, zoneId, sensorMac } = body;

    if (temperature === undefined || humidity === undefined) {
      return NextResponse.json({ error: 'Missing temperature or humidity' }, { status: 400 });
    }

    // Push to PGMQ
    const payload = {
      air_temp_c: temperature,
      relative_humidity: humidity,
      room_id: roomId || 'default',
      zone_id: zoneId || 'Main',
      sensor_mac: sensorMac || 'unknown',
      timestamp: new Date().toISOString(),
      leaf_offset_c: 2.0,
    };

    await db.$executeRaw`
      SELECT pgmq.send('sensor_pings', ${JSON.stringify(payload)}::jsonb)
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}