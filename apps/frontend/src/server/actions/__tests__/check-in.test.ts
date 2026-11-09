import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB before importing the action under test. `db` and `prisma`
// are the same object in src/lib/db.ts; we mock both names so either
// import shape resolves.
const txPlantUpdate = vi.fn();
const txDryBackLogCreate = vi.fn().mockResolvedValue({ id: 123 });

vi.mock("@/lib/db", () => ({
  db: {
    plant: {
      findUnique: vi.fn().mockResolvedValue({
        wetWeight: 10,
        dryTarget: 5,
        containerGallons: 5,
        batchId: null,
      }),
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        dryBackLog: { create: txDryBackLogCreate },
        plant: { update: txPlantUpdate },
      })
    ),
  },
  prisma: {},
}));

vi.mock("@/lib/session", () => ({ getUserId: vi.fn().mockResolvedValue("user_1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { recordIrrigation } from "../check-in";

describe("recordIrrigation", () => {
  beforeEach(() => {
    txPlantUpdate.mockClear();
    txDryBackLogCreate.mockClear();
  });

  it("writes Plant.currentWeight even when eventDate is backdated", async () => {
    const result = await recordIrrigation({
      plantId: "plant_1",
      preWeightLbs: 8,
      postWeightLbs: 12,
      watered: true,
      fed: false,
      eventDate: "2020-01-01", // deliberately far in the past
    });

    expect(result.success).toBe(true);

    // The regression: the old "only if today" guard skipped this call
    // for backdated events, leaving Plant.currentWeight stale. After the
    // fix, the column is written unconditionally when postWeightLbs exists.
    const weightUpdate = txPlantUpdate.mock.calls.find(
      (call: unknown[]) => {
        const args = call[0] as { data?: Record<string, unknown> } | undefined;
        return args?.data != null && "currentWeight" in args.data;
      }
    );
    expect(weightUpdate).toBeDefined();
    expect(weightUpdate![0]).toEqual({
      where: { id: "plant_1" },
      data: { currentWeight: 12 },
    });
  });
});