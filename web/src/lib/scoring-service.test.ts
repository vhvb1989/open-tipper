/**
 * Scoring Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock scoring module
vi.mock("./scoring", () => ({
  calculateScore: vi.fn(),
  isPlayoffStage: vi.fn(),
}));

import { calculateScore, isPlayoffStage } from "./scoring";

// Mock prisma
const mockPrisma = {
  match: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  prediction: {
    findMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
  },
  group: {
    findMany: vi.fn(),
  },
};

import { scoreMatch, scoreFinishedMatches, backfillDefaultPredictions } from "./scoring-service";
import type { PrismaClient } from "@/generated/prisma/client";

const db = mockPrisma as unknown as PrismaClient;

describe("scoreMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPlayoffStage).mockReturnValue(false);
    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 3,
      totalGoals: 2,
      reverseGoalDifference: 0,
      total: 25,
    });
  });

  it("throws if match not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    await expect(scoreMatch("m1", db)).rejects.toThrow("Match m1 not found");
  });

  it("throws if match has no result", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: null,
      awayGoals: null,
      status: "SCHEDULED",
      stage: null,
    });
    await expect(scoreMatch("m1", db)).rejects.toThrow("no result yet");
  });

  it("returns 0 scored when no predictions exist", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 2,
      awayGoals: 1,
      status: "FINISHED",
      stage: "GROUP_STAGE",
    });
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    const result = await scoreMatch("m1", db);
    expect(result).toEqual({ matchId: "m1", predictionsScored: 0 });
  });

  it("scores predictions using group scoring rules", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 2,
      awayGoals: 1,
      status: "FINISHED",
      stage: "GROUP_STAGE",
    });
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 2,
        awayGoals: 1,
        isBackfilled: false,
        group: {
          scoringRules: {
            exactScore: 10,
            goalDifference: 6,
            outcome: 4,
            oneTeamGoals: 3,
            totalGoals: 2,
            reverseGoalDifference: 1,
            accumulationMode: "ACCUMULATE",
            playoffMultiplier: false,
            uniqueBonusEnabled: false,
            uniqueBonusMultiplier: 2.0,
          },
        },
      },
      {
        id: "p2",
        groupId: "g1",
        homeGoals: 1,
        awayGoals: 0,
        isBackfilled: false,
        group: {
          scoringRules: null, // uses defaults
        },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});
    mockPrisma.match.update.mockResolvedValue({});

    const result = await scoreMatch("m1", db);

    expect(result.predictionsScored).toBe(2);
    expect(mockPrisma.prediction.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 25, bonusPoints: 0 },
    });
    expect(mockPrisma.match.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { scoredHomeGoals: 2, scoredAwayGoals: 1 },
    });
    expect(calculateScore).toHaveBeenCalledTimes(2);
  });

  it("passes isPlayoff=true for knockout stages", async () => {
    vi.mocked(isPlayoffStage).mockReturnValue(true);

    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 1,
      awayGoals: 0,
      status: "FINISHED",
      stage: "QUARTER_FINALS",
    });
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 1,
        awayGoals: 0,
        isBackfilled: false,
        group: { scoringRules: null },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    await scoreMatch("m1", db);

    expect(calculateScore).toHaveBeenCalledWith(
      { homeGoals: 1, awayGoals: 0 },
      { homeGoals: 1, awayGoals: 0 },
      expect.any(Object),
      true,
    );
  });
});

describe("scoreFinishedMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPlayoffStage).mockReturnValue(false);
    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 0,
      goalDifference: 0,
      outcome: 4,
      oneTeamGoals: 0,
      totalGoals: 0,
      reverseGoalDifference: 0,
      total: 4,
    });
  });

  it("finds and scores finished matches with unscored predictions", async () => {
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "m1",
        homeGoals: 2,
        awayGoals: 1,
        scoredHomeGoals: 2,
        scoredAwayGoals: 1,
        predictions: [{ id: "p1" }],
      },
      {
        id: "m2",
        homeGoals: 0,
        awayGoals: 0,
        scoredHomeGoals: 0,
        scoredAwayGoals: 0,
        predictions: [{ id: "p2" }],
      },
    ]);
    mockPrisma.match.findUnique
      .mockResolvedValueOnce({
        id: "m1",
        homeGoals: 2,
        awayGoals: 1,
        status: "FINISHED",
        stage: null,
      })
      .mockResolvedValueOnce({
        id: "m2",
        homeGoals: 0,
        awayGoals: 0,
        status: "FINISHED",
        stage: null,
      });
    mockPrisma.prediction.findMany
      .mockResolvedValueOnce([
        {
          id: "p1",
          groupId: "g1",
          homeGoals: 2,
          awayGoals: 1,
          isBackfilled: false,
          group: { scoringRules: null },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "p2",
          groupId: "g1",
          homeGoals: 1,
          awayGoals: 1,
          isBackfilled: false,
          group: { scoringRules: null },
        },
      ]);
    mockPrisma.prediction.update.mockResolvedValue({});
    mockPrisma.match.update.mockResolvedValue({});

    const results = await scoreFinishedMatches("c1", db);

    expect(results).toHaveLength(2);
    expect(results[0].predictionsScored).toBe(1);
    expect(results[1].predictionsScored).toBe(1);
  });

  it("re-scores predictions when the provider corrects a finished result", async () => {
    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 3,
      totalGoals: 2,
      reverseGoalDifference: 0,
      total: 25,
    });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "m1",
        homeGoals: 1,
        awayGoals: 2,
        scoredHomeGoals: 1,
        scoredAwayGoals: 1,
        predictions: [],
      },
    ]);
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 1,
      awayGoals: 2,
      status: "FINISHED",
      stage: null,
    });
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 1,
        awayGoals: 2,
        isBackfilled: false,
        group: { scoringRules: null },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});
    mockPrisma.match.update.mockResolvedValue({});

    const results = await scoreFinishedMatches("c1", db);

    expect(results).toEqual([{ matchId: "m1", predictionsScored: 1 }]);
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 25, bonusPoints: 0 },
    });
    expect(mockPrisma.match.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { scoredHomeGoals: 1, scoredAwayGoals: 2 },
    });
  });

  it("skips matches already scored against the current result", async () => {
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "m1",
        homeGoals: 1,
        awayGoals: 2,
        scoredHomeGoals: 1,
        scoredAwayGoals: 2,
        predictions: [],
      },
    ]);

    const results = await scoreFinishedMatches("c1", db);

    expect(results).toEqual([]);
    expect(mockPrisma.match.findUnique).not.toHaveBeenCalled();
  });

  it("returns empty array when no finished matches", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    const results = await scoreFinishedMatches("c1", db);
    expect(results).toEqual([]);
  });
});

describe("backfillDefaultPredictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero when no matches have kicked off", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);

    const result = await backfillDefaultPredictions("c1", db);

    expect(result).toEqual({ matchesProcessed: 0, predictionsCreated: 0 });
    expect(mockPrisma.group.findMany).not.toHaveBeenCalled();
  });

  it("returns zero when no groups exist for the contest", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1" }]);
    mockPrisma.group.findMany.mockResolvedValue([]);

    const result = await backfillDefaultPredictions("c1", db);

    expect(result).toEqual({ matchesProcessed: 0, predictionsCreated: 0 });
  });

  it("creates 0-0 predictions for members missing predictions", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    mockPrisma.group.findMany.mockResolvedValue([
      {
        id: "g1",
        memberships: [{ userId: "u1" }, { userId: "u2" }],
      },
    ]);
    // u1 has prediction for m1 only, u2 has none
    mockPrisma.prediction.findMany.mockResolvedValue([{ userId: "u1", matchId: "m1" }]);
    mockPrisma.prediction.createMany.mockResolvedValue({ count: 3 });

    const result = await backfillDefaultPredictions("c1", db);

    expect(result.predictionsCreated).toBe(3);
    expect(mockPrisma.prediction.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: "u1",
          matchId: "m2",
          homeGoals: 0,
          awayGoals: 0,
          isBackfilled: true,
        }),
        expect.objectContaining({
          userId: "u2",
          matchId: "m1",
          homeGoals: 0,
          awayGoals: 0,
          isBackfilled: true,
        }),
        expect.objectContaining({
          userId: "u2",
          matchId: "m2",
          homeGoals: 0,
          awayGoals: 0,
          isBackfilled: true,
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it("skips groups with no members", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1" }]);
    mockPrisma.group.findMany.mockResolvedValue([{ id: "g1", memberships: [] }]);

    const result = await backfillDefaultPredictions("c1", db);

    expect(result).toEqual({ matchesProcessed: 1, predictionsCreated: 0 });
    expect(mockPrisma.prediction.createMany).not.toHaveBeenCalled();
  });

  it("handles multiple groups independently", async () => {
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1" }]);
    mockPrisma.group.findMany.mockResolvedValue([
      { id: "g1", memberships: [{ userId: "u1" }] },
      { id: "g2", memberships: [{ userId: "u2" }] },
    ]);
    mockPrisma.prediction.findMany
      .mockResolvedValueOnce([]) // g1: no predictions
      .mockResolvedValueOnce([]); // g2: no predictions
    mockPrisma.prediction.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await backfillDefaultPredictions("c1", db);

    expect(result.predictionsCreated).toBe(2);
    expect(mockPrisma.prediction.createMany).toHaveBeenCalledTimes(2);
  });
});

describe("uniqueness bonus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPlayoffStage).mockReturnValue(false);
  });

  const bonusRules = {
    exactScore: 10,
    goalDifference: 6,
    outcome: 4,
    oneTeamGoals: 3,
    totalGoals: 2,
    reverseGoalDifference: 1,
    accumulationMode: "ACCUMULATE" as const,
    playoffMultiplier: false,
    uniqueBonusEnabled: true,
    uniqueBonusMultiplier: 2.0,
    bonusEnabledAt: new Date("2025-01-01T00:00:00Z"),
  };

  it("awards bonus when a factor is unique to one player", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 2,
      awayGoals: 1,
      status: "FINISHED",
      stage: null,
      kickoffTime: new Date("2025-06-01T20:00:00Z"),
    });

    // Player 1 gets exactScore + GD + outcome, Player 2 gets only outcome
    vi.mocked(calculateScore)
      .mockReturnValueOnce({
        exactScore: 10,
        goalDifference: 6,
        outcome: 4,
        oneTeamGoals: 0,
        totalGoals: 0,
        reverseGoalDifference: 0,
        total: 20,
      })
      .mockReturnValueOnce({
        exactScore: 0,
        goalDifference: 0,
        outcome: 4,
        oneTeamGoals: 0,
        totalGoals: 0,
        reverseGoalDifference: 0,
        total: 4,
      });

    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 2,
        awayGoals: 1,
        isBackfilled: false,
        group: { scoringRules: bonusRules },
      },
      {
        id: "p2",
        groupId: "g1",
        homeGoals: 1,
        awayGoals: 0,
        isBackfilled: false,
        group: { scoringRules: bonusRules },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    await scoreMatch("m1", db);

    // p1: exactScore(10) unique → +10, goalDifference(6) unique → +6, outcome shared → 0 bonus
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 20, bonusPoints: 16 },
    });
    // p2: outcome shared → 0 bonus
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { pointsAwarded: 4, bonusPoints: 0 },
    });
  });

  it("does not award bonus to backfilled predictions", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 0,
      awayGoals: 0,
      status: "FINISHED",
      stage: null,
      kickoffTime: new Date("2025-06-01T20:00:00Z"),
    });

    // Both get exactScore, but p2 is backfilled
    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 3,
      totalGoals: 2,
      reverseGoalDifference: 0,
      total: 25,
    });

    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 0,
        awayGoals: 0,
        isBackfilled: false,
        group: { scoringRules: bonusRules },
      },
      {
        id: "p2",
        groupId: "g1",
        homeGoals: 0,
        awayGoals: 0,
        isBackfilled: true,
        group: { scoringRules: bonusRules },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    await scoreMatch("m1", db);

    // p1: not unique because p2 also scored (even though backfilled, both have same factors)
    // But backfilled predictions are excluded from uniqueness count
    // So p1 is the only non-backfilled one → all factors are unique
    // But wait — the count only counts non-backfilled, so p1 is count=1 for each factor
    // p2 is backfilled → bonusPoints = 0
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { pointsAwarded: 25, bonusPoints: 0 },
    });
  });

  it("does not award bonus when feature is disabled", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 2,
      awayGoals: 1,
      status: "FINISHED",
      stage: null,
      kickoffTime: new Date("2025-06-01T20:00:00Z"),
    });

    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 0,
      totalGoals: 0,
      reverseGoalDifference: 0,
      total: 20,
    });

    const disabledRules = { ...bonusRules, uniqueBonusEnabled: false };
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 2,
        awayGoals: 1,
        isBackfilled: false,
        group: { scoringRules: disabledRules },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    await scoreMatch("m1", db);

    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 20, bonusPoints: 0 },
    });
  });

  it("does not award bonus to matches that kicked off before bonusEnabledAt", async () => {
    // Match kicked off on Jan 1, but bonus was enabled on June 1
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 2,
      awayGoals: 1,
      status: "FINISHED",
      stage: null,
      kickoffTime: new Date("2025-01-15T20:00:00Z"),
    });

    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 0,
      totalGoals: 0,
      reverseGoalDifference: 0,
      total: 20,
    });

    const rulesEnabledLater = {
      ...bonusRules,
      bonusEnabledAt: new Date("2025-06-01T00:00:00Z"),
    };
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 2,
        awayGoals: 1,
        isBackfilled: false,
        group: { scoringRules: rulesEnabledLater },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    await scoreMatch("m1", db);

    // No bonus because match kicked off before bonus was enabled
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 20, bonusPoints: 0 },
    });
  });

  it("does not award bonus when bonusEnabledAt is null", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      homeGoals: 2,
      awayGoals: 1,
      status: "FINISHED",
      stage: null,
      kickoffTime: new Date("2025-06-01T20:00:00Z"),
    });

    vi.mocked(calculateScore).mockReturnValue({
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 0,
      totalGoals: 0,
      reverseGoalDifference: 0,
      total: 20,
    });

    // bonusEnabled is true but bonusEnabledAt is null (legacy data)
    const rulesNullTimestamp = { ...bonusRules, bonusEnabledAt: null };
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        id: "p1",
        groupId: "g1",
        homeGoals: 2,
        awayGoals: 1,
        isBackfilled: false,
        group: { scoringRules: rulesNullTimestamp },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    await scoreMatch("m1", db);

    // No bonus because bonusEnabledAt is null
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 20, bonusPoints: 0 },
    });
  });
});
