"use server";

import { db } from "@/lib/db";
import { serializePrisma } from "@/lib/serializePrisma";

// We recreate the FeedSchedule type here to match the UI's expectations
// but derived from the database.
export type DbFeedSchedule = {
  id: string;
  brand: string;
  name: string;
  targetEc: number;
  targetPhMin: number;
  targetPhMax: number;
  doses: Array<{
    productName: string;
    category: string;
    mlPerGallon: number;
    guaranteedPct: {
      N: number; P: number; K: number; Ca: number; Mg: number;
    };
  }>;
};

export async function getFeedScheduleForWeek(
  protocolId: string,
  stage: string,
  week: number
): Promise<DbFeedSchedule | null> {
  const protocol = await db.feedProtocol.findUnique({
    where: { id: protocolId },
    include: {
      doses: {
        where: { stage, week },
        include: { product: true },
      },
    },
  });

  if (!protocol || protocol.doses.length === 0) return null;

  // Extract pH/EC from the first dose (they should all be the same for the week)
  const firstDose = protocol.doses[0];

  // Map the Prisma result to the shape the UI expects
  const schedule = {
    id: protocol.id,
    brand: protocol.brand,
    name: protocol.name,
    targetEc: Number(firstDose.targetEc ?? 0),
    targetPhMin: Number(firstDose.targetPhMin ?? 0),
    targetPhMax: Number(firstDose.targetPhMax ?? 0),
    doses: protocol.doses.map((d) => ({
      productName: d.product.name,
      category: d.product.category,
      mlPerGallon: Number(d.mlPerGallon),
      guaranteedPct: {
        N: Number(d.product.pctN ?? 0),
        P: Number(d.product.pctP ?? 0),
        K: Number(d.product.pctK ?? 0),
        Ca: Number(d.product.pctCa ?? 0),
        Mg: Number(d.product.pctMg ?? 0),
      },
    })),
  };

  return serializePrisma(schedule);
}