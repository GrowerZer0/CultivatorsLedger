"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const logCureEventSchema = z.object({
  plantId: z.string(),
  eventType: z.enum(["burp", "jar_check", "boveda_swap"]).default("burp"),
  durationMins: z.number().int().min(1).max(1440).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function logCureEvent(data: unknown) {
  try {
    const validated = logCureEventSchema.parse(data);
    const userId = await getUserId();
    if (!userId) return { success: false as const, error: "Unauthorized" };

    // Verify the plant belongs to this user and is in the cure stage.
    const plant = await db.plant.findFirst({
      where: { id: validated.plantId, userId },
      select: { id: true, stage: true },
    });
    if (!plant) return { success: false as const, error: "Plant not found." };
    if ((plant.stage ?? "").toLowerCase() !== "cure") {
      return {
        success: false as const,
        error: "Burp logging is only available during the cure stage.",
      };
    }

    const event = await db.cureEvent.create({
      data: {
        plantId: validated.plantId,
        userId,
        eventType: validated.eventType,
        durationMins: validated.durationMins ?? null,
        notes: validated.notes ?? null,
      },
    });

    revalidatePath(`/plants/${validated.plantId}`);
    revalidatePath("/dashboard");

    return {
      success: true as const,
      event: {
        id: event.id,
        occurredAt: event.occurredAt.toISOString(),
        eventType: event.eventType,
        durationMins: event.durationMins,
        notes: event.notes,
      },
    };
  } catch (error) {
    console.error("logCureEvent error:", error);
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues.map((i) => i.message).join(", "),
      };
    }
    return { success: false as const, error: "Failed to log cure event." };
  }
}

/**
 * Returns burp events for a plant, newest first. Used by DryCureTracker
 * to show "last burp: Xh ago" and whether today's burp is done.
 */
export async function getCureEvents(plantId: string) {
  const userId = await getUserId();
  if (!userId) return [];

  const events = await db.cureEvent.findMany({
    where: { plantId, userId, eventType: "burp" },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  return events.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt.toISOString(),
    eventType: e.eventType,
    durationMins: e.durationMins,
    notes: e.notes,
  }));
}

export async function deleteCureEvent(eventId: string) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false as const, error: "Unauthorized" };

    await db.cureEvent.deleteMany({
      where: { id: eventId, userId },
    });

    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (error) {
    console.error("deleteCureEvent error:", error);
    return { success: false as const, error: "Failed to delete burp" };
  }
}