"use server";

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await admin.storage
    .from("plant-photos")
    .createSignedUrls(paths, 60 * 60);

  if (error || !data) {
    console.error("Failed to create signed URLs:", error);
    return {};
  }

  const result: Record<string, string> = {};
  data.forEach((item) => {
    if (item.signedUrl && item.path) {
      result[item.path] = item.signedUrl;
    }
  });
  return result;
}