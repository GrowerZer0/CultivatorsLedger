import { z } from "zod";

export const controllerReadingSchema = z.object({
  controllerId: z.string().min(1),
  temperatureF: z.number(),
  humidity: z.number().min(0).max(100),
  vpd: z.number().min(0),
  co2Ppm: z.number().optional(),
  lightPpfd: z.number().optional(),
  recordedAt: z.string().datetime().optional()
});

export type ControllerReading = z.infer<typeof controllerReadingSchema>;

export async function fetchControllerReading(endpoint: string, apiKey: string): Promise<ControllerReading> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Controller sync failed with ${response.status}`);
  }

  return controllerReadingSchema.parse(await response.json());
}
