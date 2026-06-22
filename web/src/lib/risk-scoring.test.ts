/**
 * Risk Scoring Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRisksForMatch } from "./risk-scoring";

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

function createMockDb() {
  return {
    matchStats: {
      findUnique: vi.fn(),
    },
    riskPrediction: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    match: {
      findMany: vi.fn(),
    },
  } as unknown as Parameters<typeof resolveRisksForMatch>[1];
}

describe("resolveRisksForMatch", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns 0 resolved when no match stats exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue(null);

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 0, won: 0, lost: 0 });
  });

  it("returns 0 resolved when no pending risks exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue({
      yellowCards: 5,
      redCards: 1,
      cornerKicks: 10,
      offsides: 3,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.findMany.mockResolvedValue([]);

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 0, won: 0, lost: 0 });
  });

  it("marks correct prediction as WON with the tiered (3×) payout", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue({
      yellowCards: 5,
      redCards: 1,
      cornerKicks: 10,
      offsides: 3,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.findMany.mockResolvedValue([
      {
        id: "risk-1",
        category: "YELLOW_CARDS",
        predictedValue: 5,
        pointsRisked: 10,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.update.mockResolvedValue({});

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 1, won: 1, lost: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).riskPrediction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "risk-1" },
        data: expect.objectContaining({
          status: "WON",
          pointsAwarded: 30,
        }),
      }),
    );
  });

  it("refunds the stake (1×) for a near-miss within the refund tier", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue({
      yellowCards: 5,
      redCards: 1,
      cornerKicks: 10,
      offsides: 3,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.findMany.mockResolvedValue([
      {
        id: "risk-refund",
        category: "CORNER_KICKS",
        predictedValue: 8, // actual 10 → off by 2 → refund tier
        pointsRisked: 5,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.update.mockResolvedValue({});

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 1, won: 1, lost: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).riskPrediction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "risk-refund" },
        data: expect.objectContaining({
          status: "WON",
          pointsAwarded: 5,
        }),
      }),
    );
  });

  it("marks incorrect prediction as LOST with 0 points", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue({
      yellowCards: 5,
      redCards: 1,
      cornerKicks: 10,
      offsides: 3,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.findMany.mockResolvedValue([
      {
        id: "risk-2",
        category: "CORNER_KICKS",
        predictedValue: 5, // actual is 10 → off by 5 → lost
        pointsRisked: 5,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.update.mockResolvedValue({});

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 1, won: 0, lost: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).riskPrediction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "risk-2" },
        data: expect.objectContaining({
          status: "LOST",
          pointsAwarded: 0,
        }),
      }),
    );
  });

  it("treats null stat value as 0 and resolves the risk", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue({
      yellowCards: 5,
      redCards: null, // not reported = treated as 0
      cornerKicks: 10,
      offsides: 3,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.findMany.mockResolvedValue([
      {
        id: "risk-3",
        category: "RED_CARDS",
        predictedValue: 1, // predicted 1, actual is 0 → LOST
        pointsRisked: 3,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.update.mockResolvedValue({});

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 1, won: 0, lost: 1 });
  });

  it("resolves multiple risks for the same match (mix of won and lost)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).matchStats.findUnique.mockResolvedValue({
      yellowCards: 5,
      redCards: 1,
      cornerKicks: 10,
      offsides: 3,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.findMany.mockResolvedValue([
      { id: "r1", category: "YELLOW_CARDS", predictedValue: 5, pointsRisked: 10 }, // WON (exact)
      { id: "r2", category: "RED_CARDS", predictedValue: 0, pointsRisked: 5 }, // LOST (no vs actual yes)
      { id: "r3", category: "OFFSIDES", predictedValue: 3, pointsRisked: 8 }, // WON (exact)
      { id: "r4", category: "CORNER_KICKS", predictedValue: 14, pointsRisked: 4 }, // LOST (off by 4)
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).riskPrediction.update.mockResolvedValue({});

    const result = await resolveRisksForMatch("match-1", db);

    expect(result).toEqual({ matchId: "match-1", resolved: 4, won: 2, lost: 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).riskPrediction.update).toHaveBeenCalledTimes(4);
  });
});
