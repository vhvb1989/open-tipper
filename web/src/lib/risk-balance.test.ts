import { describe, it, expect, vi } from "vitest";

import { getAvailableBalance, getDisplayBalance, getRiskPointsSummary } from "./risk-balance";
import { RiskStatus, type PrismaClient } from "@/generated/prisma/client";

const mockPrisma = {
  prediction: {
    aggregate: vi.fn(),
  },
  riskPrediction: {
    groupBy: vi.fn(),
  },
};

const db = mockPrisma as unknown as PrismaClient;

function mockPredictionPoints(pointsAwarded = 0, bonusPoints = 0) {
  mockPrisma.prediction.aggregate.mockResolvedValue({
    _sum: {
      pointsAwarded,
      bonusPoints,
    },
  });
}

function mockRiskTotals(
  rows: Array<{
    status: RiskStatus;
    pointsRisked?: number | null;
    pointsAwarded?: number | null;
  }> = [],
) {
  mockPrisma.riskPrediction.groupBy.mockResolvedValue(
    rows.map((row) => ({
      status: row.status,
      _sum: {
        pointsRisked: row.pointsRisked ?? 0,
        pointsAwarded: row.pointsAwarded ?? 0,
      },
    })),
  );
}

describe("risk balance", () => {
  it("returns 0 for a user with no predictions or risks", async () => {
    vi.clearAllMocks();
    mockPredictionPoints();
    mockRiskTotals();

    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(0);
    await expect(getDisplayBalance("u1", "g1", db)).resolves.toBe(0);
    await expect(getRiskPointsSummary("u1", "g1", db)).resolves.toEqual({
      netRiskPoints: 0,
      totalPending: 0,
    });
  });

  it("sums scored prediction and bonus points when there are no risks", async () => {
    vi.clearAllMocks();
    mockPredictionPoints(18, 4);
    mockRiskTotals();

    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(22);
    await expect(getDisplayBalance("u1", "g1", db)).resolves.toBe(22);
  });

  it("reduces available balance for pending risks but keeps display balance stable", async () => {
    vi.clearAllMocks();
    mockPredictionPoints(20, 5);
    mockRiskTotals([{ status: RiskStatus.PENDING, pointsRisked: 8 }]);

    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(17);
    await expect(getDisplayBalance("u1", "g1", db)).resolves.toBe(25);
    await expect(getRiskPointsSummary("u1", "g1", db)).resolves.toEqual({
      netRiskPoints: 0,
      totalPending: 8,
    });
  });

  it("adds won risk points to both balances (net gain = pointsAwarded - stake)", async () => {
    vi.clearAllMocks();
    mockPredictionPoints(14, 1);
    // Risked 10, won 20 → net gain = 10
    mockRiskTotals([{ status: RiskStatus.WON, pointsRisked: 10, pointsAwarded: 20 }]);

    // 15 + 20 - 10 = 25
    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(25);
    await expect(getDisplayBalance("u1", "g1", db)).resolves.toBe(25);
    await expect(getRiskPointsSummary("u1", "g1", db)).resolves.toEqual({
      netRiskPoints: 10,
      totalPending: 0,
    });
  });

  it("subtracts lost risk points from both balances", async () => {
    vi.clearAllMocks();
    mockPredictionPoints(12, 3);
    mockRiskTotals([{ status: RiskStatus.LOST, pointsRisked: 6, pointsAwarded: 0 }]);

    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(9);
    await expect(getDisplayBalance("u1", "g1", db)).resolves.toBe(9);
    await expect(getRiskPointsSummary("u1", "g1", db)).resolves.toEqual({
      netRiskPoints: -6,
      totalPending: 0,
    });
  });

  it("handles mixed risk states correctly", async () => {
    vi.clearAllMocks();
    mockPredictionPoints(15, 5);
    mockRiskTotals([
      { status: RiskStatus.PENDING, pointsRisked: 4 },
      { status: RiskStatus.WON, pointsRisked: 10, pointsAwarded: 20 },
      { status: RiskStatus.LOST, pointsRisked: 6, pointsAwarded: 0 },
    ]);

    // available: 20 + 20 - 10 - 4 - 6 = 20
    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(20);
    // display: 20 + 20 - 10 - 6 = 24
    await expect(getDisplayBalance("u1", "g1", db)).resolves.toBe(24);
    await expect(getRiskPointsSummary("u1", "g1", db)).resolves.toEqual({
      // net: 20 - 10 - 6 = 4
      netRiskPoints: 4,
      totalPending: 4,
    });
  });

  it("never returns a negative available balance", async () => {
    vi.clearAllMocks();
    mockPredictionPoints(3, 0);
    mockRiskTotals([
      { status: RiskStatus.PENDING, pointsRisked: 4 },
      { status: RiskStatus.LOST, pointsRisked: 10, pointsAwarded: 0 },
    ]);

    await expect(getAvailableBalance("u1", "g1", db)).resolves.toBe(0);
  });
});
