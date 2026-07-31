"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function getSystemSettings() {
  const userId = await getUserId();

  const settings = await db.systemSetting.findFirst({
    where: { userId },
  });

  if (!settings) {
    return { preferredTempUnit: "C" };
  }

  return {
    ...settings,
    defaultLeafOffsetC: settings.defaultLeafOffsetC
      ? Number(settings.defaultLeafOffsetC)
      : null,
  };
}

export async function updateTempUnitPreference(unit: "C" | "F") {
  const userId = await getUserId();

  const existing = await db.systemSetting.findFirst({
    where: { userId },
  });

  if (existing) {
    await db.systemSetting.update({
      where: { id: existing.id },
      data: { preferredTempUnit: unit },
    });
  } else {
    await db.systemSetting.create({
      data: { userId, preferredTempUnit: unit },
    });
  }

  return { success: true };
}