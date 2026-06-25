import { NextResponse } from "next/server";
import { z } from "zod";

const hardwareAuthSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  controllerBrand: z.string().trim().min(1).optional(),
  profileId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = hardwareAuthSchema.parse(await request.json());
    const edgeResponse = await fetch(getHardwareAuthFunctionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getSupabaseFunctionKey()}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await edgeResponse.json().catch(() => ({}));
    return NextResponse.json(payload, { status: edgeResponse.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Missing or invalid hardware authentication fields." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Hardware authentication failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getHardwareAuthFunctionUrl() {
  const explicitUrl = process.env.SUPABASE_HARDWARE_AUTH_URL;
  if (explicitUrl) return explicitUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for hardware auth.");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/hardware-auth`;
}

function getSupabaseFunctionKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY for Edge Function invocation.");
  }
  return key;
}
