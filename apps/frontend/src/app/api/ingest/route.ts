import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.INGEST_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return NextResponse.json({ success: true, message: 'Queued' });
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}