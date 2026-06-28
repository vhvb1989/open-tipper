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

import { syncCompetition, parseRoundPrefix } from "./sync";
import type { FootballApiClient } from "./football-api";
import type { PrismaClient } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Fixtures — API-Football v3 response shapes
// ---------------------------------------------------------------------------

function makeMockApi() {
  return {
    getLeague: vi.fn().mockResolvedValue({
      get: "leagues",
      parameters: { id: "2" },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [
        {
          league: {
            id: 2,
            name: "UEFA Champions League",
            type: "Cup",
            logo: "https://media.api-sports.io/football/leagues/2.png",
          },
          country: { name: "World", code: null, flag: null },
          seasons: [
            {
              year: 2025,
              start: "2025-09-01",
              end: "2026-06-01",
              current: true,
              coverage: {},
            },
          ],
        },
      ],
    }),
    getFixtures: vi.fn().mockResolvedValue({
      get: "fixtures",
      parameters: { league: "2", season: "2025" },
      errors: [],
      results: 2,
      paging: { current: 1, total: 1 },
      response: [
        {
          fixture: {
            id: 101,
            date: "2025-09-16T19:00:00+00:00",
            status: { short: "FT", long: "Match Finished", elapsed: 90 },
          },
          league: { id: 2, name: "UEFA Champions League", round: "League Stage - 1" },
          teams: {
            home: { id: 10, name: "FC Alpha", logo: null },
            away: { id: 20, name: "FC Beta", logo: null },
          },
          goals: { home: 2, away: 1 },
          score: {
            halftime: { home: 1, away: 0 },
            fulltime: { home: 2, away: 1 },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null },
          },
        },
        {
          fixture: {
            id: 102,
            date: "2025-09-17T19:00:00+00:00",
            status: { short: "NS", long: "Not Started", elapsed: null },
          },
          league: { id: 2, name: "UEFA Champions League", round: "League Stage - 1" },
          teams: {
            home: { id: 30, name: "FC Gamma", logo: null },
            away: { id: 10, name: "FC Alpha", logo: null },
          },
          goals: { home: null, away: null },
          score: {
            halftime: { home: null, away: null },
            fulltime: { home: null, away: null },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null },
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
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    prediction: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    group: {
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

  it("upserts contest from league data", async () => {
    await syncCompetition(2, undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    expect(mockApi.getLeague).toHaveBeenCalledWith(2);
    expect(
      (mockDb as unknown as { contest: { upsert: ReturnType<typeof vi.fn> } }).contest.upsert,
    ).toHaveBeenCalledTimes(1);

    const upsertCall = (mockDb as unknown as { contest: { upsert: ReturnType<typeof vi.fn> } })
      .contest.upsert.mock.calls[0][0];
    expect(upsertCall.create.code).toBe("2");
    expect(upsertCall.create.name).toBe("UEFA Champions League");
    expect(upsertCall.create.season).toBe("2025");
  });

  it("extracts unique teams from fixtures and upserts them", async () => {
    const result = await syncCompetition(
      2,
      undefined,
      mockDb as PrismaClient,
      mockApi as FootballApiClient,
    );

    // 3 unique teams: Alpha (10), Beta (20), Gamma (30)
    expect(result.teamsUpserted).toBe(3);
    expect(
      (mockDb as unknown as { team: { upsert: ReturnType<typeof vi.fn> } }).team.upsert,
    ).toHaveBeenCalledTimes(3);
  });

  it("upserts all matches with correct team references", async () => {
    const result = await syncCompetition(
      2,
      undefined,
      mockDb as PrismaClient,
      mockApi as FootballApiClient,
    );

    expect(result.matchesUpserted).toBe(2);
    expect(
      (mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } }).match.upsert,
    ).toHaveBeenCalledTimes(2);
  });

  it("maps FT status to FINISHED correctly", async () => {
    await syncCompetition(2, undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    const firstMatchCall = (mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } })
      .match.upsert.mock.calls[0][0];
    expect(firstMatchCall.create.status).toBe("FINISHED");
    expect(firstMatchCall.create.homeGoals).toBe(2);
    expect(firstMatchCall.create.awayGoals).toBe(1);
  });

  it("handles NS (Not Started) fixtures with null scores", async () => {
    await syncCompetition(2, undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    const secondMatchCall = (mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } })
      .match.upsert.mock.calls[1][0];
    expect(secondMatchCall.create.status).toBe("SCHEDULED");
    expect(secondMatchCall.create.homeGoals).toBeNull();
    expect(secondMatchCall.create.awayGoals).toBeNull();
  });

  it("does not call $disconnect when db is provided", async () => {
    await syncCompetition(2, undefined, mockDb as PrismaClient, mockApi as FootballApiClient);
    expect(
      (mockDb as unknown as { $disconnect: ReturnType<typeof vi.fn> }).$disconnect,
    ).not.toHaveBeenCalled();
  });

  it("returns a SyncResult with correct counts", async () => {
    const result = await syncCompetition(
      2,
      undefined,
      mockDb as PrismaClient,
      mockApi as FootballApiClient,
    );

    expect(result).toEqual({
      contestId: "contest-1",
      teamsUpserted: 3,
      matchesUpserted: 2,
      predictionsBackfilled: 0,
      predictionsScored: 0,
    });
  });

  it("sets group field from round prefix during upsert", async () => {
    await syncCompetition(2, undefined, mockDb as PrismaClient, mockApi as FootballApiClient);

    const firstMatchCall = (mockDb as unknown as { match: { upsert: ReturnType<typeof vi.fn> } })
      .match.upsert.mock.calls[0][0];
    // "League Stage - 1" → group = "League Stage"
    expect(firstMatchCall.create.group).toBe("League Stage");
  });
});

// ---------------------------------------------------------------------------
// Post-match review window behaviour
// ---------------------------------------------------------------------------

function makeStatsResponse(stats: {
  yellowCards: number;
  redCards?: number;
  cornerKicks: number;
  offsides: number;
}) {
  return {
    response: [
      {
        statistics: [
          { type: "Yellow Cards", value: stats.yellowCards },
          { type: "Red Cards", value: stats.redCards ?? 0 },
          { type: "Corner Kicks", value: stats.cornerKicks },
          { type: "Offsides", value: stats.offsides },
        ],
      },
    ],
  };
}

interface ReviewMatchRow {
  id: string;
  externalId: number;
  status: string;
  finishedAt: Date | null;
  reviewPollCount: number;
  reviewStableCount: number;
  stats: {
    yellowCards: number | null;
    redCards: number | null;
    cornerKicks: number | null;
    offsides: number | null;
  } | null;
  _count: { riskPredictions: number };
}

function makeReviewApi(statsResponse: ReturnType<typeof makeStatsResponse>) {
  return {
    getLeague: vi.fn().mockResolvedValue({
      response: [
        {
          league: { id: 1, name: "FIFA World Cup", type: "Cup", logo: null },
          country: { name: "World", code: null, flag: null },
          seasons: [{ year: 2026, start: "2026-06-01", end: "2026-07-19", current: true }],
        },
      ],
    }),
    // No fixtures — isolate the review-window step from team/match upserts.
    getFixtures: vi.fn().mockResolvedValue({ errors: [], response: [] }),
    getFixtureStatistics: vi.fn().mockResolvedValue(statsResponse),
  } as unknown as FootballApiClient;
}

function makeReviewDb(reviewMatch: ReviewMatchRow) {
  return {
    contest: {
      upsert: vi.fn().mockResolvedValue({ id: "contest-1" }),
    },
    match: {
      upsert: vi.fn().mockResolvedValue({ id: "m1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockImplementation(({ where }) => {
        // 8a: live in-game stats set
        if (where?.status?.in?.includes("IN_PLAY")) return Promise.resolve([]);
        // 8b: post-match review set
        if (where?.risksCompleted === false) return Promise.resolve([reviewMatch]);
        // resolveRisksForContest and any other queries
        return Promise.resolve([]);
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    matchStats: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as PrismaClient;
}

describe("syncCompetition — post-match review window", () => {
  const provisional = { yellowCards: 2, redCards: 0, cornerKicks: 9, offsides: 3 };
  // FT long enough ago that the minimum review wait is satisfied.
  const PAST_MIN_WAIT = new Date(Date.now() - 12 * 60 * 1000);
  // FT just now — inside the minimum review wait.
  const WITHIN_MIN_WAIT = new Date(Date.now() - 2 * 60 * 1000);

  function baseMatch(overrides: Partial<ReviewMatchRow> = {}): ReviewMatchRow {
    return {
      id: "m1",
      externalId: 5001,
      status: "FINISHED",
      finishedAt: PAST_MIN_WAIT,
      reviewPollCount: 0,
      reviewStableCount: 0,
      stats: { ...provisional },
      _count: { riskPredictions: 2 },
      ...overrides,
    };
  }

  function getUpdate(db: PrismaClient) {
    return (db as unknown as { match: { update: ReturnType<typeof vi.fn> } }).match.update;
  }
  function getStatsUpsert(db: PrismaClient) {
    return (db as unknown as { matchStats: { upsert: ReturnType<typeof vi.fn> } }).matchStats
      .upsert;
  }

  it("keeps a stale finished match in review when stats change (late offside 0→1)", async () => {
    const db = makeReviewDb(baseMatch({ stats: { ...provisional, offsides: 0 } }));
    const api = makeReviewApi(makeStatsResponse({ ...provisional, offsides: 1 }));

    await syncCompetition(1, undefined, db, api);

    // Corrected stats written…
    expect(getStatsUpsert(db)).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ offsides: 1 }),
      }),
    );
    // …and the window stays open (stability reset).
    expect(getUpdate(db)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1" },
        data: { reviewPollCount: 1, reviewStableCount: 0, risksCompleted: false },
      }),
    );
  });

  it("closes the review window once stats are stable AND the minimum wait has elapsed", async () => {
    // One stable poll already recorded; this poll reaches REVIEW_STABLE_REQUIRED (2),
    // and FT was 12 min ago so the minimum wait is satisfied.
    const db = makeReviewDb(baseMatch({ reviewPollCount: 1, reviewStableCount: 1 }));
    const api = makeReviewApi(makeStatsResponse(provisional));

    await syncCompetition(1, undefined, db, api);

    expect(getUpdate(db)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reviewPollCount: 2, reviewStableCount: 2, risksCompleted: true },
      }),
    );
  });

  it("does NOT resolve while stats are stable but the minimum wait has not elapsed", async () => {
    // Stable enough, but FT was only 2 min ago.
    const db = makeReviewDb(
      baseMatch({ reviewPollCount: 1, reviewStableCount: 1, finishedAt: WITHIN_MIN_WAIT }),
    );
    const api = makeReviewApi(makeStatsResponse(provisional));

    await syncCompetition(1, undefined, db, api);

    expect(getUpdate(db)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reviewPollCount: 2, reviewStableCount: 2, risksCompleted: false },
      }),
    );
  });

  it("completes immediately for a finished match with no risk predictions (no extra polling)", async () => {
    const db = makeReviewDb(baseMatch({ _count: { riskPredictions: 0 } }));
    const api = makeReviewApi(makeStatsResponse(provisional));

    await syncCompetition(1, undefined, db, api);

    // Marked complete without entering the review counters.
    expect(getUpdate(db)).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { risksCompleted: true },
    });
    // Stats already present and complete → no stats call spent on it.
    expect(
      (api as unknown as { getFixtureStatistics: ReturnType<typeof vi.fn> }).getFixtureStatistics,
    ).not.toHaveBeenCalled();
  });

  it("bypasses the review window for AWARDED matches (resolves immediately)", async () => {
    const db = makeReviewDb(baseMatch({ status: "AWARDED" }));
    const api = makeReviewApi(makeStatsResponse(provisional));

    await syncCompetition(1, undefined, db, api);

    expect(getUpdate(db)).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { risksCompleted: true },
    });
  });

  it("does not settle (or overwrite stats) when the provider returns an empty response", async () => {
    const db = makeReviewDb(baseMatch());
    // Provider hasn't aggregated stats yet → empty response array.
    const api = makeReviewApi({ response: [] } as unknown as ReturnType<typeof makeStatsResponse>);

    await syncCompetition(1, undefined, db, api);

    // Window must NOT advance/close, and provisional stats must NOT be clobbered.
    expect(getUpdate(db)).not.toHaveBeenCalled();
    expect(getStatsUpsert(db)).not.toHaveBeenCalled();
  });

  it("does not complete an AWARDED match until stats are available", async () => {
    // No stored stats yet and provider returns nothing → keep retrying.
    const db = makeReviewDb(baseMatch({ status: "AWARDED", stats: null }));
    const api = makeReviewApi({ response: [] } as unknown as ReturnType<typeof makeStatsResponse>);

    await syncCompetition(1, undefined, db, api);

    expect(getUpdate(db)).not.toHaveBeenCalled();
  });
});

describe("parseRoundPrefix", () => {
  it("extracts Apertura from Liga MX round", () => {
    expect(parseRoundPrefix("Apertura - 1")).toBe("Apertura");
  });

  it("extracts Clausura from Liga MX round", () => {
    expect(parseRoundPrefix("Clausura - Quarter-finals")).toBe("Clausura");
  });

  it("extracts Regular Season prefix", () => {
    expect(parseRoundPrefix("Regular Season - 14")).toBe("Regular Season");
  });

  it("extracts League Stage prefix", () => {
    expect(parseRoundPrefix("League Stage - 8")).toBe("League Stage");
  });

  it("returns null for Round of 16", () => {
    expect(parseRoundPrefix("Round of 16")).toBeNull();
  });

  it("returns null for Quarter-finals", () => {
    expect(parseRoundPrefix("Quarter-finals")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRoundPrefix("")).toBeNull();
  });
});
