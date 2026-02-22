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
  },
  prediction: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

import { scoreMatch, scoreFinishedMatches } from "./scoring-service";
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
        homeGoals: 2,
        awayGoals: 1,
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
          },
        },
      },
      {
        id: "p2",
        homeGoals: 1,
        awayGoals: 0,
        group: {
          scoringRules: null, // uses defaults
        },
      },
    ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    const result = await scoreMatch("m1", db);

    expect(result.predictionsScored).toBe(2);
    expect(mockPrisma.prediction.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.prediction.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { pointsAwarded: 25 },
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
        homeGoals: 1,
        awayGoals: 0,
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
    mockPrisma.match.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
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
        { id: "p1", homeGoals: 2, awayGoals: 1, group: { scoringRules: null } },
      ])
      .mockResolvedValueOnce([
        { id: "p2", homeGoals: 1, awayGoals: 1, group: { scoringRules: null } },
      ]);
    mockPrisma.prediction.update.mockResolvedValue({});

    const results = await scoreFinishedMatches("c1", db);

    expect(results).toHaveLength(2);
    expect(results[0].predictionsScored).toBe(1);
    expect(results[1].predictionsScored).toBe(1);
  });

  it("returns empty array when no finished matches", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    const results = await scoreFinishedMatches("c1", db);
    expect(results).toEqual([]);
  });
});
