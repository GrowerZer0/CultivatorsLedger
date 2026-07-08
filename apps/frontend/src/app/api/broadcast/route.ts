import { NextRequest, NextResponse } from 'next/server';

// Import the WebSocket server's broadcast function
// We need to ensure the WebSocket server is running separately.
// We'll use a global reference or import dynamically.

let broadcastFn: (data: any) => void;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If we have a broadcast function, send the data
    if (broadcastFn) {
      broadcastFn(body);
      return NextResponse.json({ success: true });
    } else {
      console.warn('WebSocket broadcast function not available.');
      return NextResponse.json({ error: 'WebSocket server not ready' }, { status: 503 });
    }
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Function to set the broadcast function from the WebSocket server
export function setBroadcastFunction(fn: (data: any) => void) {
  broadcastFn = fn;
}
