import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock prisma
const mockPrisma = {
  group: { findUnique: vi.fn() },
  membership: { findUnique: vi.fn() },
  prediction: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  match: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

const NOW = new Date("2025-06-15T12:00:00Z");

describe("Predictions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ================================================================
     GET /api/groups/:id/predictions — current user's predictions
     ================================================================ */
  describe("GET /api/groups/:id/predictions", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { GET } = await import("@/app/api/groups/[id]/predictions/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      const { GET } = await import("@/app/api/groups/[id]/predictions/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("returns predictions keyed by matchId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.prediction.findMany.mockResolvedValue([
        {
          id: "p1",
          matchId: "m1",
          homeGoals: 2,
          awayGoals: 1,
          pointsAwarded: null,
          updatedAt: new Date(),
        },
        {
          id: "p2",
          matchId: "m2",
          homeGoals: 0,
          awayGoals: 0,
          pointsAwarded: 3,
          updatedAt: new Date(),
        },
      ]);

      const { GET } = await import("@/app/api/groups/[id]/predictions/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.predictions.m1).toEqual({ homeGoals: 2, awayGoals: 1, pointsAwarded: null });
      expect(body.predictions.m2).toEqual({ homeGoals: 0, awayGoals: 0, pointsAwarded: 3 });
    });
  });

  /* ================================================================
     PUT /api/groups/:id/predictions — upsert a prediction
     ================================================================ */
  describe("PUT /api/groups/:id/predictions", () => {
    const makePut = (groupId: string, body: Record<string, unknown>) =>
      new NextRequest(`http://localhost/api/groups/${groupId}/predictions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: 1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: 1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid input (negative goals)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: -1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing matchId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { homeGoals: 1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(400);
    });

    it("returns 404 when match not found in contest", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1" });
      mockPrisma.match.findUnique.mockResolvedValue(null);
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: 1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(404);
    });

    it("returns 403 when match has kicked off (kickoffTime in past)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1" });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-15T11:00:00Z"), // 1 hour before NOW
        status: "IN_PLAY",
      });
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: 1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("returns 403 when match status is FINISHED", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1" });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-14T20:00:00Z"),
        status: "FINISHED",
      });
      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: 1, awayGoals: 0 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("upserts prediction for upcoming match", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1" });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-16T20:00:00Z"), // tomorrow
        status: "SCHEDULED",
      });
      mockPrisma.prediction.upsert.mockResolvedValue({
        matchId: "m1",
        homeGoals: 2,
        awayGoals: 1,
      });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/route");
      const req = makePut("g1", { matchId: "m1", homeGoals: 2, awayGoals: 1 });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.prediction).toEqual({ matchId: "m1", homeGoals: 2, awayGoals: 1 });
      expect(mockPrisma.prediction.upsert).toHaveBeenCalledWith({
        where: { userId_groupId_matchId: { userId: "u1", groupId: "g1", matchId: "m1" } },
        update: { homeGoals: 2, awayGoals: 1 },
        create: { userId: "u1", groupId: "g1", matchId: "m1", homeGoals: 2, awayGoals: 1 },
      });
    });
  });

  /* ================================================================
     GET /api/groups/:id/predictions/all — all members' predictions
     ================================================================ */
  describe("GET /api/groups/:id/predictions/all", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { GET } = await import("@/app/api/groups/[id]/predictions/all/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/all");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 when not a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      const { GET } = await import("@/app/api/groups/[id]/predictions/all/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/all");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("returns predictions grouped by matchId for started matches only", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1" });
      mockPrisma.prediction.findMany.mockResolvedValue([
        {
          matchId: "m1",
          homeGoals: 2,
          awayGoals: 1,
          pointsAwarded: null,
          user: { id: "u1", name: "Alice", image: null },
        },
        {
          matchId: "m1",
          homeGoals: 1,
          awayGoals: 1,
          pointsAwarded: null,
          user: { id: "u2", name: "Bob", image: null },
        },
      ]);

      const { GET } = await import("@/app/api/groups/[id]/predictions/all/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/all");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.predictions.m1).toHaveLength(2);
      expect(body.predictions.m1[0].userName).toBe("Alice");
      expect(body.predictions.m1[1].userName).toBe("Bob");
    });
  });

  /* ================================================================
     GET /api/groups/:id/matches
     ================================================================ */
  describe("GET /api/groups/:id/matches", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { GET } = await import("@/app/api/groups/[id]/matches/route");
      const req = new NextRequest("http://localhost/api/groups/g1/matches");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(401);
    });

    it("returns matches with match day navigation info", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "g1",
        contestId: "c1",
        visibility: "PRIVATE",
        memberships: [{ role: "MEMBER" }],
      });
      mockPrisma.match.findMany
        .mockResolvedValueOnce([
          // allContestMatches (for active group + rounds)
          {
            matchDay: 1,
            stage: "Clausura - 1",
            kickoffTime: new Date("2025-06-18T20:00:00Z"),
            group: "Clausura",
          },
          {
            matchDay: 2,
            stage: "Clausura - 2",
            kickoffTime: new Date("2025-06-20T20:00:00Z"),
            group: "Clausura",
          },
          {
            matchDay: 3,
            stage: "Clausura - 3",
            kickoffTime: new Date("2025-06-22T20:00:00Z"),
            group: "Clausura",
          },
        ])
        .mockResolvedValueOnce([
          // main matches query (filtered by matchDay)
          {
            id: "m1",
            matchDay: 1,
            group: "Clausura",
            kickoffTime: new Date("2025-06-20T20:00:00Z"),
            status: "SCHEDULED",
            homeTeam: { id: "t1", name: "Team A", shortName: "TMA", tla: "TMA", crest: null },
            awayTeam: { id: "t2", name: "Team B", shortName: "TMB", tla: "TMB", crest: null },
          },
        ])
        .mockResolvedValueOnce([]); // finishedMatches for W-L-D records

      const { GET } = await import("@/app/api/groups/[id]/matches/route");
      const req = new NextRequest("http://localhost/api/groups/g1/matches?matchDay=1");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.matches).toHaveLength(1);
      expect(body.matchDays).toEqual([1, 2, 3]);
      expect(body.currentMatchDay).toBe(1);
    });

    it("filters team records to active sub-tournament only", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "g1",
        contestId: "c1",
        visibility: "PUBLIC",
        memberships: [{ role: "MEMBER" }],
      });

      mockPrisma.match.findMany
        .mockResolvedValueOnce([
          // allContestMatches (for active group + rounds)
          {
            matchDay: 1,
            stage: "Clausura - 1",
            kickoffTime: new Date("2025-06-20T20:00:00Z"),
            group: "Clausura",
          },
        ])
        .mockResolvedValueOnce([
          // main matches query (filtered)
          {
            id: "m1",
            matchDay: 1,
            group: "Clausura",
            kickoffTime: new Date("2025-06-20T20:00:00Z"),
            status: "SCHEDULED",
            homeTeam: { id: "t1", name: "Team A", shortName: "TMA", tla: "TMA", crest: null },
            awayTeam: { id: "t2", name: "Team B", shortName: "TMB", tla: "TMB", crest: null },
          },
        ])
        .mockResolvedValueOnce([
          // finishedMatches for W-L-D records
          { homeTeamId: "t1", awayTeamId: "t2", homeGoals: 2, awayGoals: 1 },
        ]);

      const { GET } = await import("@/app/api/groups/[id]/matches/route");
      const req = new NextRequest("http://localhost/api/groups/g1/matches?matchDay=1");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);

      // Verify the records query filters by group and matchDay (3rd call)
      const recordsQueryCall = mockPrisma.match.findMany.mock.calls[2][0];
      expect(recordsQueryCall.where).toEqual({
        contestId: "c1",
        status: "FINISHED",
        matchDay: { not: null },
        group: { in: ["Clausura"] },
      });

      // Verify records are computed from the filtered results
      expect(body.matches[0].homeTeam.record).toEqual({ wins: 1, losses: 0, draws: 0 });
      expect(body.matches[0].awayTeam.record).toEqual({ wins: 0, losses: 1, draws: 0 });
    });
  });
});

// Need afterEach import at top level
import { afterEach } from "vitest";
