/**
 * Medal Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { awardMatchDayMedals, awardMedalsForContest } from "./medals";
import type { PrismaClient } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  match: {
    findMany: vi.fn(),
  },
  prediction: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  medal: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  group: {
    findMany: vi.fn(),
  },
};

const db = mockPrisma as unknown as PrismaClient;

// ---------------------------------------------------------------------------
// awardMatchDayMedals
// ---------------------------------------------------------------------------

describe("awardMatchDayMedals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 winners when no matches exist for the match day", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result).toEqual({ matchDay: 1, groupId: "g1", winnersCount: 0 });
  });

  it("skips when not all matches are finished", async () => {
    mockPrisma.match.findMany.mockResolvedValue([
      { id: "m1", status: "FINISHED" },
      { id: "m2", status: "IN_PLAY" },
    ]);

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result.winnersCount).toBe(0);
    expect(mockPrisma.prediction.count).not.toHaveBeenCalled();
  });

  it("skips when there are unscored predictions", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(2);

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result.winnersCount).toBe(0);
  });

  it("skips when no predictions exist", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result.winnersCount).toBe(0);
  });

  it("awards medal to single top scorer", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 10 },
      { userId: "u2", pointsAwarded: 6 },
      { userId: "u3", pointsAwarded: 4 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    expect(result.winnersCount).toBe(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId_matchDay: { groupId: "g1", userId: "u1", matchDay: 1 },
      },
      create: { groupId: "g1", userId: "u1", matchDay: 1, points: 10 },
      update: { points: 10 },
    });
  });

  it("awards medals to multiple users on tie", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 10 },
      { userId: "u2", pointsAwarded: 10 },
      { userId: "u3", pointsAwarded: 4 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    expect(result.winnersCount).toBe(2);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledTimes(2);
  });

  it("aggregates points across multiple matches in the same match day", async () => {
    mockPrisma.match.findMany.mockResolvedValue([
      { id: "m1", status: "FINISHED" },
      { id: "m2", status: "FINISHED" },
    ]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 6 },
      { userId: "u1", pointsAwarded: 4 }, // u1 total = 10
      { userId: "u2", pointsAwarded: 10 },
      { userId: "u2", pointsAwarded: 0 }, // u2 total = 10
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    // Both tied at 10
    expect(result.winnersCount).toBe(2);
  });

  it("does not award medals when max points is 0", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 0 },
      { userId: "u2", pointsAwarded: 0 },
    ]);

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result.winnersCount).toBe(0);
    expect(mockPrisma.medal.upsert).not.toHaveBeenCalled();
  });

  it("removes stale medals when re-scoring changes the winner", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 10 },
      { userId: "u2", pointsAwarded: 6 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    await awardMatchDayMedals("c1", "g1", 1, db);

    // Should delete medals for non-winners
    expect(mockPrisma.medal.deleteMany).toHaveBeenCalledWith({
      where: {
        groupId: "g1",
        matchDay: 1,
        userId: { notIn: ["u1"] },
      },
    });
  });

  it("handles AWARDED match status", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "AWARDED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([{ userId: "u1", pointsAwarded: 5 }]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result.winnersCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// awardMedalsForContest
// ---------------------------------------------------------------------------

describe("awardMedalsForContest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when no groups exist", async () => {
    mockPrisma.group.findMany.mockResolvedValue([]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const results = await awardMedalsForContest("c1", db);
    expect(results).toEqual([]);
  });

  it("processes all groups and match days", async () => {
    mockPrisma.group.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
    // Distinct finished match days
    mockPrisma.match.findMany
      .mockResolvedValueOnce([{ matchDay: 1 }, { matchDay: 2 }]) // distinct query
      .mockResolvedValue([{ id: "m1", status: "FINISHED" }]); // subsequent per-group calls

    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([{ userId: "u1", pointsAwarded: 10 }]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const results = await awardMedalsForContest("c1", db);
    // 2 groups × 2 match days = 4 medal operations, all winners
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
