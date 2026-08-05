import { z } from "zod";

export function formatZodError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }
  return "Validation failed";
}

// Reusable schemas
export const idSchema = z.string().cuid().optional();

export const plantSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "Name is required").max(100),
  strain: z.string().max(100).optional().nullable(),
  roomId: z.string().cuid().optional().nullable(),
  batchId: z.string().cuid().optional().nullable(),
  containerGallons: z.number().min(0).max(100).optional().nullable(),
  wetWeight: z.number().min(0).max(1000).optional().nullable(),
  dryTarget: z.number().min(0).max(1000).optional().nullable(),
  currentWeight: z.number().min(0).max(1000).optional().nullable(),
});

export const batchSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "Name is required").max(100),
  cultivar: z.string().min(1, "Cultivar is required").max(100),
  roomId: z.string().cuid().optional().nullable(),
  startDate: z.union([z.date(), z.string()]).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const roomSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["tent", "room", "outdoor"]).default("tent"),
  targetTempF: z.number().min(0).max(120).optional().nullable(),
  targetRH: z.number().min(0).max(100).optional().nullable(),
  targetVPD: z.number().min(0).max(5).optional().nullable(),
  lightOnTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  lightOffTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  ppfd: z.number().min(0).max(3000).optional().nullable(),
  lightDistance: z.number().min(0).max(100).optional().nullable(),
});

export const checkInSchema = z.object({
  plantId: z.string().cuid("Valid plant ID is required"),
  weight: z.number().min(0).max(1000).optional().nullable(),
  watered: z.boolean().default(false),
  fed: z.boolean().default(false),
  trainingEvent: z.enum(["None", "Top", "Defoliate", "LST", "Flip", "Harvest"]).default("None"),
  notes: z.string().max(500).optional().nullable(),
});

// AI prompt validation – prevent injection
export const aiPromptSchema = z.object({
  query: z.string().min(1).max(500),
  // Only allow safe characters – strip any attempts at prompt injection
  // This will be handled in the action itself
});

// Helper: Sanitize AI input (strip malicious patterns)
export function sanitizePrompt(input: string): string {
  // Remove common injection patterns
  return input
    .replace(/ignore\s+all\s+previous\s+instructions/gi, "")
    .replace(/system\s+prompt/gi, "")
    .replace(/you\s+are\s+a\s+new\s+AI/gi, "")
    .trim();
}