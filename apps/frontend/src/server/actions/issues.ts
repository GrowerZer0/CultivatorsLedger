"use server";

import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const logIssueSchema = z.object({
  plantId: z.string(),
  symptoms: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional().nullable(),
});

export async function logIssue(data: unknown) {
  try {
    const { plantId, symptoms, notes } = logIssueSchema.parse(data);
    const userId = await getUserId();
    if (!userId) return { success: false as const, error: "Unauthorized" };

    const plant = await db.plant.findFirst({
      where: { id: plantId, userId },
      select: { id: true },
    });
    if (!plant) return { success: false as const, error: "Plant not found" };

    const issue = await db.plantIssue.create({
      data: {
        userId,
        plantId,
        symptoms,
        notes: notes ?? null,
      },
    });

    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/dashboard");
    return { success: true as const, issueId: issue.id };
  } catch (error) {
    console.error("logIssue error:", error);
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues.map((i) => i.message).join(", "),
      };
    }
    return { success: false as const, error: "Failed to log issue" };
  }
}

export async function resolveIssue(issueId: string) {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false as const, error: "Unauthorized" };

    await db.plantIssue.update({
      where: { id: issueId, userId },
      data: { resolved: true, resolvedAt: new Date() },
    });

    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (error) {
    console.error("resolveIssue error:", error);
    return { success: false as const, error: "Failed to resolve issue" };
  }
}