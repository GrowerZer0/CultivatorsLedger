// src/app/api/telemetry/v1/route.ts
//
// Hardware ingestion endpoint for devices/scripts that PUSH telemetry to us
// (the X-Hardware-Token pattern — DIY hubs, webhook integrations). This is
// distinct from the Vivosun-style flow where WE poll a vendor cloud using
// stored credentials (see app/actions/hardware.ts).
//
// Auth: token arrives as a plaintext header, gets hashed in-memory, and is
// looked up by that hash against token_hash. The plaintext is never logged,
// never stored, and never appears in a URL (query strings end up in access
// logs, browser history, and reverse-proxy logs — headers generally don't).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";

const numeric = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected a finite number." });
    return z.NEVER;
  }
  return parsed;
});

const legacyTelemetrySchema = z
  .object({
    facilityId: z.string().min(1).optional(),
    roomId: z.string().min(1).optional(),
    controllerId: z.string().min(1).optional(),
    temperatureF: numeric.optional(),
    tempF: numeric.optional(),
    humidity: numeric.optional(),
    rh: numeric.optional(),
    vpd: numeric.optional(),
    brand: z.string().min(1).optional(),
    runoff_ec: numeric.optional(),
    runoffEc: numeric.optional(),
    dry_back: numeric.optional(),
    weightLbs: numeric.optional(),
    mediaWeightLbs: numeric.optional(),
    recordedAt: z.string().datetime().optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  try {
    // 1. Task 0.6: header-based auth, never a query string.
    const rawToken = request.headers.get("X-Hardware-Token");
    if (!rawToken || !rawToken.startsWith("lt_")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or malformed X-Hardware-Token header." },
        { status: 401 },
      );
    }

    // 2. Task 0.7: hash the incoming token, look up by hash. We never store
    // or compare plaintext tokens — only their SHA-256 digest.
    const tokenHash = hashToken(rawToken);

    const tokenRecord = await db.userHardwareToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || !tokenRecord.isActive || tokenRecord.revokedAt) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid, inactive, or revoked hardware token." },
        { status: 401 },
      );
    }

    // 3. Parse and validate payload.
    const rawBody = await request.json();
    const body = legacyTelemetrySchema.parse(rawBody);

    const temperatureF = body.temperatureF ?? body.tempF;
    const humidity = body.humidity ?? body.rh;

    if (temperatureF === undefined || humidity === undefined) {
      return NextResponse.json(
        { error: "Bad Request: Payload must include numerical temperatureF and humidity parameters." },
        { status: 400 },
      );
    }

    // 4. Forward to the Edge ingestion function. Note: we forward the
    // *resolved* userId from our own token lookup, not the raw token —
    // the Edge Function should trust this call (authenticated via the
    // service-role bearer below) rather than re-deriving tenancy itself.
    const edgeUrl = getTelemetryFunctionUrl();
    const edgeResponse = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getSupabaseFunctionKey()}`,
      },
      body: JSON.stringify({
        ...body,
        userId: tokenRecord.userId,
        temperatureF,
        humidity,
        source: body.brand ?? tokenRecord.providerBrand ?? "legacy-next-webhook",
      }),
      cache: "no-store",
    });

    const payload = await edgeResponse.json().catch(() => ({}));

    if (!edgeResponse.ok) {
      return NextResponse.json(payload, { status: edgeResponse.status });
    }

    // 5. Update last-seen / device-id metadata.
    await db.userHardwareToken.update({
      where: { id: tokenRecord.id },
      data: {
        updatedAt: new Date(),
        ...(body.controllerId ? { currentDeviceId: body.controllerId } : {}),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Data packet ingested successfully.",
        timestamp: payload.timestamp ?? new Date().toISOString(),
        recordId: payload.recordId ?? payload.packetId,
        packetId: payload.packetId ?? payload.recordId,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Bad Request: Invalid telemetry payload." }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Internal Server Processing Error";
    console.error("Telemetry ingestion failure:", message);
    return NextResponse.json({ error: "Internal Server Processing Error" }, { status: 500 });
  }
}

function getTelemetryFunctionUrl() {
  const explicitUrl = process.env.SUPABASE_TELEMETRY_INGEST_URL;
  if (explicitUrl) return explicitUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for telemetry ingestion.");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telemetry-ingest`;
}

function getSupabaseFunctionKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY for Edge Function invocation.");
  }
  return key;
}