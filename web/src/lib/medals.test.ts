/**
 * Medal Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { awardMatchDayMedals, awardStageMedals, awardMedalsForContest } from "./medals";
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
  riskPrediction: {
    findMany: vi.fn(),
  },
  medal: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  group: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

const db = mockPrisma as unknown as PrismaClient;

// ---------------------------------------------------------------------------
// awardMatchDayMedals
// ---------------------------------------------------------------------------

describe("awardMatchDayMedals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: risk feature disabled and no risk predictions
    mockPrisma.group.findUnique.mockResolvedValue({ riskEnabled: false });
    mockPrisma.riskPrediction.findMany.mockResolvedValue([]);
  });

  it("returns 0 winners when no matches exist for the match day", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);

    const result = await awardMatchDayMedals("c1", "g1", 1, db);
    expect(result).toEqual({
      round: "md:1",
      matchDay: 1,
      stage: null,
      groupId: "g1",
      winnersCount: 0,
    });
  });

  it("queries matches for the match day", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    await awardMatchDayMedals("c1", "g1", 3, db);
    expect(mockPrisma.match.findMany).toHaveBeenCalledWith({
      where: { contestId: "c1", matchDay: 3 },
      select: { id: true, status: true },
    });
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
        groupId_userId_round: { groupId: "g1", userId: "u1", round: "md:1" },
      },
      create: { groupId: "g1", userId: "u1", round: "md:1", matchDay: 1, stage: null, points: 10 },
      update: { points: 10, matchDay: 1, stage: null },
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

    // Should delete medals for non-winners, scoped by round
    expect(mockPrisma.medal.deleteMany).toHaveBeenCalledWith({
      where: {
        groupId: "g1",
        round: "md:1",
        userId: { notIn: ["u1"] },
      },
    });
  });

  it("includes uniqueness bonus points when determining the winner", async () => {
    // Without bonus: u1=160 wins over u2=158. With bonus, u2 gets +10 → 168 wins.
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 160, bonusPoints: 0 },
      { userId: "u2", pointsAwarded: 158, bonusPoints: 10 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    expect(result.winnersCount).toBe(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId_round: { groupId: "g1", userId: "u2", round: "md:1" },
      },
      create: { groupId: "g1", userId: "u2", round: "md:1", matchDay: 1, stage: null, points: 168 },
      update: { points: 168, matchDay: 1, stage: null },
    });
  });

  it("includes net risk points when the risk feature is enabled", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ riskEnabled: true });
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 20, bonusPoints: 0 },
      { userId: "u2", pointsAwarded: 18, bonusPoints: 0 },
    ]);
    // u2 won a risk: +20 net (40 awarded - 20 risked) → 18 + 20 = 38 beats u1's 20
    mockPrisma.riskPrediction.findMany.mockResolvedValue([
      { userId: "u2", status: "WON", pointsRisked: 20, pointsAwarded: 40 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    expect(result.winnersCount).toBe(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId_round: { groupId: "g1", userId: "u2", round: "md:1" },
      },
      create: { groupId: "g1", userId: "u2", round: "md:1", matchDay: 1, stage: null, points: 38 },
      update: { points: 38, matchDay: 1, stage: null },
    });
  });

  it("subtracts lost risk stakes from the match-day score", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ riskEnabled: true });
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 30, bonusPoints: 0 },
      { userId: "u2", pointsAwarded: 25, bonusPoints: 0 },
    ]);
    // u1 lost a 15 stake → 30 - 15 = 15, so u2 (25) wins
    mockPrisma.riskPrediction.findMany.mockResolvedValue([
      { userId: "u1", status: "LOST", pointsRisked: 15, pointsAwarded: 0 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    expect(result.winnersCount).toBe(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId_round: { groupId: "g1", userId: "u2", round: "md:1" },
      },
      create: { groupId: "g1", userId: "u2", round: "md:1", matchDay: 1, stage: null, points: 25 },
      update: { points: 25, matchDay: 1, stage: null },
    });
  });

  it("ignores risk points when the risk feature is disabled", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ riskEnabled: false });
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 20, bonusPoints: 0 },
      { userId: "u2", pointsAwarded: 18, bonusPoints: 0 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardMatchDayMedals("c1", "g1", 1, db);

    // Risk disabled → not queried, u1 wins on base points
    expect(mockPrisma.riskPrediction.findMany).not.toHaveBeenCalled();
    expect(result.winnersCount).toBe(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId_round: { groupId: "g1", userId: "u1", round: "md:1" },
      },
      create: { groupId: "g1", userId: "u1", round: "md:1", matchDay: 1, stage: null, points: 20 },
      update: { points: 20, matchDay: 1, stage: null },
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
// awardStageMedals (playoff rounds)
// ---------------------------------------------------------------------------

describe("awardStageMedals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.group.findUnique.mockResolvedValue({ riskEnabled: false });
    mockPrisma.riskPrediction.findMany.mockResolvedValue([]);
  });

  it("queries matches by stage with a null match day", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    await awardStageMedals("c1", "g1", "Round of 16", db);
    expect(mockPrisma.match.findMany).toHaveBeenCalledWith({
      where: { contestId: "c1", stage: "Round of 16", matchDay: null },
      select: { id: true, status: true },
    });
  });

  it("returns the stage descriptor when no matches exist", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    const result = await awardStageMedals("c1", "g1", "Round of 16", db);
    expect(result).toEqual({
      round: "stage:Round of 16",
      matchDay: null,
      stage: "Round of 16",
      groupId: "g1",
      winnersCount: 0,
    });
  });

  it("awards a playoff medal keyed on the stage round", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1", status: "FINISHED" }]);
    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "u1", pointsAwarded: 12 },
      { userId: "u2", pointsAwarded: 8 },
    ]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const result = await awardStageMedals("c1", "g1", "Round of 16", db);

    expect(result.winnersCount).toBe(1);
    expect(mockPrisma.medal.upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId_round: { groupId: "g1", userId: "u1", round: "stage:Round of 16" },
      },
      create: {
        groupId: "g1",
        userId: "u1",
        round: "stage:Round of 16",
        matchDay: null,
        stage: "Round of 16",
        points: 12,
      },
      update: { points: 12, matchDay: null, stage: "Round of 16" },
    });
  });
});

// ---------------------------------------------------------------------------
// awardMedalsForContest
// ---------------------------------------------------------------------------

describe("awardMedalsForContest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.group.findUnique.mockResolvedValue({ riskEnabled: false });
    mockPrisma.riskPrediction.findMany.mockResolvedValue([]);
  });

  it("returns empty when no groups exist", async () => {
    mockPrisma.group.findMany.mockResolvedValue([]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const results = await awardMedalsForContest("c1", db);
    expect(results).toEqual([]);
  });

  it("processes all groups across match days and playoff stages", async () => {
    mockPrisma.group.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
    // 1st call: distinct match days; 2nd call: distinct stages; rest: per-round matches
    mockPrisma.match.findMany
      .mockResolvedValueOnce([{ matchDay: 1 }, { matchDay: 2 }]) // distinct match days
      .mockResolvedValueOnce([{ stage: "Round of 16" }]) // distinct stages
      .mockResolvedValue([{ id: "m1", status: "FINISHED" }]); // subsequent per-round calls

    mockPrisma.prediction.count.mockResolvedValue(0);
    mockPrisma.prediction.findMany.mockResolvedValue([{ userId: "u1", pointsAwarded: 10 }]);
    mockPrisma.medal.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.medal.upsert.mockResolvedValue({});

    const results = await awardMedalsForContest("c1", db);
    // 2 groups × (2 match days + 1 stage) = 6 medal operations, all winners
    expect(results.length).toBe(6);
    expect(results.some((r) => r.round === "stage:Round of 16")).toBe(true);
    expect(results.some((r) => r.round === "md:1")).toBe(true);
  });
});
