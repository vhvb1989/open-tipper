import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the modules before importing the sync module
vi.mock("@/generated/prisma/client", () => ({
  ContestStatus: { UPCOMING: "UPCOMING", ACTIVE: "ACTIVE", COMPLETED: "COMPLETED" },
  MatchStatus: {
    SCHEDULED: "SCHEDULED",
    TIMED: "TIMED",
    IN_PLAY: "IN_PLAY",
    PAUSED: "PAUSED",
    FINISHED: "FINISHED",
    SUSPENDED: "SUSPENDED",
    POSTPONED: "POSTPONED",
    CANCELLED: "CANCELLED",
    AWARDED: "AWARDED",
  },
  PrismaClient: vi.fn(),
}));

import { syncCompetition } from "./sync";
import type { FootballApiClient } from "./football-api";
import type { PrismaClient } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockApi() {
  return {
    getCompetition: vi.fn().mockResolvedValue({
      id: 2001,
      name: "UEFA Champions League",
      code: "CL",
      type: "CUP",
      emblem: "https://crests.football-data.org/CL.png",
      currentSeason: {
        id: 1,
        startDate: "2025-09-01",
        endDate: "2026-06-01",
        currentMatchday: 3,
        winner: null,
        stages: ["GROUP_STAGE"],
      },
      area: { id: 1, name: "Europe", code: "EUR" },
      seasons: [],
    }),
    getMatches: vi.fn().mockResolvedValue({
      filters: {},
      resultSet: { count: 2, first: "2025-09-16", last: "2025-09-17", played: 1 },
      competition: { id: 2001, name: "CL", code: "CL", type: "CUP", emblem: null },
      matches: [
        {
          id: 101,
          utcDate: "2025-09-16T19:00:00Z",
          status: "FINISHED",
          matchday: 1,
          stage: "GROUP_STAGE",
          group: "GROUP_A",
          homeTeam: { id: 10, name: "FC Alpha", shortName: "Alpha", tla: "ALP", crest: null },
          awayTeam: { id: 20, name: "FC Beta", shortName: "Beta", tla: "BET", crest: null },
          score: {
            winner: "HOME_TEAM",
            duration: "REGULAR",
            fullTime: { home: 2, away: 1 },
            halfTime: { home: 1, away: 0 },
          },
        },
        {
          id: 102,
          utcDate: "2025-09-17T19:00:00Z",
          status: "SCHEDULED",
          matchday: 1,
          stage: "GROUP_STAGE",
          group: "GROUP_B",
          homeTeam: { id: 30, name: "FC Gamma", shortName: "Gamma", tla: "GAM", crest: null },
          awayTeam: { id: 10, name: "FC Alpha", shortName: "Alpha", tla: "ALP", crest: null },
          score: {
            winner: null,
            duration: "REGULAR",
            fullTime: { home: null, away: null },
            halfTime: { home: null, away: null },
          },
        },
      ],
    }),
  } as unknown as FootballApiClient;
}

function makeMockDb() {
  const upsertedTeams = new Map<number, { id: string; externalId: number }>();
  let teamCounter = 0;

  return {
    contest: {
      upsert: vi.fn().mockImplementation(({ create }) => {
        return Promise.resolve({ id: "contest-1", ...create });
      }),
    },
    team: {
      upsert: vi.fn().mockImplementation(({ create }) => {
        // Return consistent IDs per externalId
        let entry = upsertedTeams.get(create.externalId);
        if (!entry) {
          entry = { id: `team-${++teamCounter}`, externalId: create.externalId };
          upsertedTeams.set(create.externalId, entry);
        }
        return Promise.resolve(entry);
      }),
    },
    match: {
      upsert: vi.fn().mockResolvedValue({ id: "match-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syncCompetition", () => {
  let mockApi: ReturnType<typeof makeMockApi>;
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mockApi = makeMockApi();
    mockDb = makeMockDb();
  });

  it("upserts contest from competition data", async () => {
    await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    expect(mockApi.getCompetition).toHaveBeenCalledWith("CL");
    expect((mockDb as unknown as { contest: { upsert: ReturnType<typeof vi.fn> } }).contest.upsert).toHaveBeenCalledTimes(1);

    const upsertCall = (mockDb as unknown as { contest: { upsert: ReturnType<typeof vi.fn> } }).contest.upsert.mock.calls[0][0];
    expect(upsertCall.create.code).toBe("CL");
    expect(upsertCall.create.name).toBe("UEFA Champions League");
    expect(upsertCall.create.season).toBe("2025/2026");
  });

  it("extracts unique teams from matches and upserts them", async () => {
    const result = await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    // 3 unique teams: Alpha (10), Beta (20), Gamma (30)
    expect(result.teamsUpserted).toBe(3);
    expect((mockDb as unknown as { team: { upsert: ReturnType<typeof vi.fn> } }).team.upsert).toHaveBeenCalledTimes(3);
  });

  it("upserts all matches with correct team references", async () => {
    const result = await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    expect(result.matchesUpserted).toBe(2);
    expect((mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } }).match.upsert).toHaveBeenCalledTimes(2);
  });

  it("maps FINISHED status correctly", async () => {
    await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    const firstMatchCall = (mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } }).match.upsert.mock.calls[0][0];
    expect(firstMatchCall.create.status).toBe("FINISHED");
    expect(firstMatchCall.create.homeGoals).toBe(2);
    expect(firstMatchCall.create.awayGoals).toBe(1);
  });

  it("handles SCHEDULED matches with null scores", async () => {
    await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    const secondMatchCall = (mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } }).match.upsert.mock.calls[1][0];
    expect(secondMatchCall.create.status).toBe("SCHEDULED");
    expect(secondMatchCall.create.homeGoals).toBeNull();
    expect(secondMatchCall.create.awayGoals).toBeNull();
  });

  it("does not call $disconnect when db is provided", async () => {
    await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);
    expect((mockDb as unknown as { $disconnect: ReturnType<typeof vi.fn> }).$disconnect).not.toHaveBeenCalled();
  });

  it("returns a SyncResult with correct counts", async () => {
    const result = await syncCompetition("CL", undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    expect(result).toEqual({
      contestId: "contest-1",
      teamsUpserted: 3,
      matchesUpserted: 2,
      predictionsScored: 0,
    });
  });
});
