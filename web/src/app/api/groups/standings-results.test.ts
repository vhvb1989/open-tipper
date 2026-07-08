import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock prisma
const mockPrisma = {
  membership: { findUnique: vi.fn(), findMany: vi.fn() },
  group: { findUnique: vi.fn() },
  prediction: { findMany: vi.fn() },
  riskPrediction: { findMany: vi.fn() },
  match: { findMany: vi.fn(), findFirst: vi.fn() },
  medal: { findMany: vi.fn() },
  podiumBadge: { findMany: vi.fn() },
  podiumPrediction: { findMany: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

/* ================================================================
   STANDINGS TESTS
   ================================================================ */
describe("Standings API — GET /api/groups/:id/standings", () => {
  const routeParams = { params: Promise.resolve({ id: "group-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riskPrediction.findMany.mockResolvedValue([]);
    mockPrisma.medal.findMany.mockResolvedValue([]);
    mockPrisma.podiumBadge.findMany.mockResolvedValue([]);
    mockPrisma.podiumPrediction.findMany.mockResolvedValue([]);
  });

  it("returns 404 when group does not exist (standings)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated access to private group standings", async () => {
    mockAuth.mockResolvedValue(null);
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PRIVATE" });

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member of private group", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PRIVATE" });
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(403);
  });

  it("returns empty standings when no predictions are scored", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.standings).toHaveLength(2);
    expect(data.standings[0].totalPoints).toBe(0);
    expect(data.standings[1].totalPoints).toBe(0);
    expect(data.matchDays).toHaveLength(0);
  });

  it("returns ranked standings sorted by total points descending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
      { user: { id: "user-3", name: "Charlie", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      // Alice: 10 + 5 = 15 total, MD1 + MD2
      {
        userId: "user-1",
        pointsAwarded: 10,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 5,
        match: { matchDay: 2, stage: null, kickoffTime: new Date("2025-06-08T18:00:00Z") },
      },
      // Bob: 20 total, MD1
      {
        userId: "user-2",
        pointsAwarded: 20,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      // Charlie: 3 total, MD2
      {
        userId: "user-3",
        pointsAwarded: 3,
        match: { matchDay: 2, stage: null, kickoffTime: new Date("2025-06-08T18:00:00Z") },
      },
    ]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.standings).toHaveLength(3);
    // Ranked: Bob(20) > Alice(15) > Charlie(3)
    expect(data.standings[0].userName).toBe("Bob");
    expect(data.standings[0].rank).toBe(1);
    expect(data.standings[0].totalPoints).toBe(20);
    expect(data.standings[1].userName).toBe("Alice");
    expect(data.standings[1].rank).toBe(2);
    expect(data.standings[1].totalPoints).toBe(15);
    expect(data.standings[2].userName).toBe("Charlie");
    expect(data.standings[2].rank).toBe(3);
    expect(data.standings[2].totalPoints).toBe(3);
  });

  it("breaks ties using predictions scored count", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      // Both have 10 points total
      {
        userId: "user-1",
        pointsAwarded: 5,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 5,
        match: { matchDay: 2, stage: null, kickoffTime: new Date("2025-06-08T18:00:00Z") },
      },
      {
        userId: "user-2",
        pointsAwarded: 10,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
    ]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Same points (10), Alice has 2 predictions scored > Bob has 1
    expect(data.standings[0].userName).toBe("Alice");
    expect(data.standings[0].predictionsScored).toBe(2);
    expect(data.standings[1].userName).toBe("Bob");
    expect(data.standings[1].predictionsScored).toBe(1);
  });

  it("returns lastRoundPoints based on latest match day", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        userId: "user-1",
        pointsAwarded: 10,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 7,
        match: { matchDay: 2, stage: null, kickoffTime: new Date("2025-06-08T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 3,
        match: { matchDay: 3, stage: null, kickoffTime: new Date("2025-06-15T18:00:00Z") },
      },
    ]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(data.standings[0].totalPoints).toBe(20);
    // Latest match day is 3, which has 3 pts
    expect(data.standings[0].lastRoundPoints).toBe(3);
    expect(data.lastMatchDay).toBe(3);
    expect(data.selectedMatchDay).toBe(3);
  });

  it("filters lastRoundPoints by matchDay query param", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        userId: "user-1",
        pointsAwarded: 10,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 7,
        match: { matchDay: 2, stage: null, kickoffTime: new Date("2025-06-08T18:00:00Z") },
      },
    ]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings?matchDay=1");
    const res = await GET(req, routeParams);
    const data = await res.json();

    // All points counted in totalPoints, but lastRoundPoints for MD1 only
    expect(data.standings[0].totalPoints).toBe(17);
    expect(data.standings[0].lastRoundPoints).toBe(10);
    expect(data.selectedMatchDay).toBe(1);
  });

  it("returns match days in ascending order", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        userId: "user-1",
        pointsAwarded: 5,
        match: { matchDay: 3, stage: null, kickoffTime: new Date("2025-06-15T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 5,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      {
        userId: "user-1",
        pointsAwarded: 5,
        match: { matchDay: 5, stage: null, kickoffTime: new Date("2025-06-29T18:00:00Z") },
      },
    ]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(data.matchDays).toEqual([1, 3, 5]);
  });

  it("adds resolved risk points to standings when risk is enabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({
      contestId: "c-1",
      visibility: "PUBLIC",
      riskEnabled: true,
    });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        userId: "user-1",
        pointsAwarded: 10,
        bonusPoints: 0,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
      {
        userId: "user-2",
        pointsAwarded: 12,
        bonusPoints: 0,
        match: { matchDay: 1, stage: null, kickoffTime: new Date("2025-06-01T18:00:00Z") },
      },
    ]);
    mockPrisma.riskPrediction.findMany.mockResolvedValue([
      {
        userId: "user-1",
        status: "WON",
        pointsRisked: 5,
        pointsAwarded: 10,
        match: { matchDay: 1, stage: null },
      },
      {
        userId: "user-2",
        status: "LOST",
        pointsRisked: 4,
        pointsAwarded: 0,
        match: { matchDay: 1, stage: null },
      },
    ]);
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.riskEnabled).toBe(true);
    expect(data.standings[0].userName).toBe("Alice");
    expect(data.standings[0].riskPoints).toBe(5);
    expect(data.standings[0].totalPoints).toBe(15);
    // lastRound = base (10) + net risk (+5)
    expect(data.standings[0].lastRoundPoints).toBe(15);
    expect(data.standings[1].userName).toBe("Bob");
    expect(data.standings[1].riskPoints).toBe(-4);
    expect(data.standings[1].totalPoints).toBe(8);
    // lastRound = base (12) + net risk (-4)
    expect(data.standings[1].lastRoundPoints).toBe(8);
    expect(mockPrisma.riskPrediction.findMany).toHaveBeenCalledWith({
      where: {
        groupId: "group-1",
        status: {
          in: ["WON", "LOST"],
        },
      },
      select: {
        userId: true,
        status: true,
        pointsRisked: true,
        pointsAwarded: true,
        match: {
          select: { matchDay: true, stage: true },
        },
      },
    });
  });
});

/* ================================================================
   RESULTS TESTS
   ================================================================ */
describe("Results API — GET /api/groups/:id/results", () => {
  const routeParams = { params: Promise.resolve({ id: "group-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riskPrediction.findMany.mockResolvedValue([]);
  });

  it("returns 404 when group does not exist (results)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated access to private group results", async () => {
    mockAuth.mockResolvedValue(null);
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PRIVATE" });

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member of private group", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PRIVATE" });
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(403);
  });

  it("returns empty results when no finished matches", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.match.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toEqual([]);
    expect(data.matchDays).toEqual([]);
  });

  it("returns finished matches with predictions attached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({
      contestId: "c-1",
      visibility: "PUBLIC",
      riskEnabled: false,
    });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "match-1",
        matchDay: 1,
        stage: "GROUP_STAGE",
        status: "FINISHED",
        kickoffTime: new Date("2025-06-01T18:00:00Z"),
        homeGoals: 2,
        awayGoals: 1,
        homeTeam: { id: "t1", name: "Team A", shortName: "TMA", tla: "TMA", crest: null },
        awayTeam: { id: "t2", name: "Team B", shortName: "TMB", tla: "TMB", crest: null },
        stats: null,
      },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        homeGoals: 2,
        awayGoals: 1,
        pointsAwarded: 25,
        bonusPoints: 0,
        isBackfilled: false,
        user: { id: "user-1", name: "Alice", image: null },
      },
      {
        matchId: "match-1",
        homeGoals: 1,
        awayGoals: 0,
        pointsAwarded: 8,
        bonusPoints: 0,
        isBackfilled: false,
        user: { id: "user-2", name: "Bob", image: null },
      },
    ]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].homeGoals).toBe(2);
    expect(data.results[0].awayGoals).toBe(1);
    expect(data.results[0].predictions).toHaveLength(2);
    expect(data.results[0].predictions[0].userName).toBe("Alice");
    expect(data.results[0].predictions[0].pointsAwarded).toBe(25);
    expect(data.results[0].predictions[1].userName).toBe("Bob");
    expect(data.results[0].predictions[1].pointsAwarded).toBe(8);
    expect(data.matchDays).toEqual([1]);
    expect(data.riskEnabled).toBe(false);
  });

  it("includes risk stats and per-user risk summaries when enabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({
      contestId: "c-1",
      visibility: "PUBLIC",
      riskEnabled: true,
    });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "match-1",
        matchDay: 1,
        stage: "GROUP_STAGE",
        status: "FINISHED",
        kickoffTime: new Date("2025-06-01T18:00:00Z"),
        homeGoals: 2,
        awayGoals: 1,
        homeTeam: { id: "t1", name: "Team A", shortName: "TMA", tla: "TMA", crest: null },
        awayTeam: { id: "t2", name: "Team B", shortName: "TMB", tla: "TMB", crest: null },
        stats: { yellowCards: 5, redCards: 1, cornerKicks: 10, offsides: 3 },
      },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        homeGoals: 2,
        awayGoals: 1,
        pointsAwarded: 25,
        bonusPoints: 0,
        isBackfilled: false,
        user: { id: "user-1", name: "Alice", image: null },
      },
    ]);
    mockPrisma.riskPrediction.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        userId: "user-1",
        category: "YELLOW_CARDS",
        predictedValue: 5,
        pointsRisked: 3,
        status: "WON",
        pointsAwarded: 6,
      },
      {
        matchId: "match-1",
        userId: "user-1",
        category: "OFFSIDES",
        predictedValue: 4,
        pointsRisked: 2,
        status: "LOST",
        pointsAwarded: 0,
      },
    ]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.riskEnabled).toBe(true);
    expect(data.results[0].matchStats).toEqual({
      yellowCards: 5,
      redCards: 1,
      cornerKicks: 10,
      offsides: 3,
    });
    expect(data.results[0].predictions[0].riskPredictions).toEqual([
      {
        category: "YELLOW_CARDS",
        predictedValue: 5,
        pointsRisked: 3,
        status: "WON",
        pointsAwarded: 6,
      },
      {
        category: "OFFSIDES",
        predictedValue: 4,
        pointsRisked: 2,
        status: "LOST",
        pointsAwarded: 0,
      },
    ]);
    expect(data.results[0].predictions[0].totalPointsRisked).toBe(5);
    expect(data.results[0].predictions[0].riskNetPoints).toBe(1);
  });

  it("returns empty predictions array for matches with no tips", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "match-1",
        matchDay: 1,
        stage: null,
        kickoffTime: new Date("2025-06-01T18:00:00Z"),
        homeGoals: 0,
        awayGoals: 0,
        homeTeam: { id: "t1", name: "Team A", shortName: null, tla: null, crest: null },
        awayTeam: { id: "t2", name: "Team B", shortName: null, tla: null, crest: null },
      },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(data.results[0].predictions).toEqual([]);
  });

  it("returns match days in descending order", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "m1",
        matchDay: 1,
        stage: null,
        kickoffTime: new Date(),
        homeGoals: 1,
        awayGoals: 0,
        homeTeam: { id: "t1", name: "A", shortName: null, tla: null, crest: null },
        awayTeam: { id: "t2", name: "B", shortName: null, tla: null, crest: null },
      },
      {
        id: "m2",
        matchDay: 3,
        stage: null,
        kickoffTime: new Date(),
        homeGoals: 2,
        awayGoals: 2,
        homeTeam: { id: "t3", name: "C", shortName: null, tla: null, crest: null },
        awayTeam: { id: "t4", name: "D", shortName: null, tla: null, crest: null },
      },
      {
        id: "m3",
        matchDay: 5,
        stage: null,
        kickoffTime: new Date(),
        homeGoals: 0,
        awayGoals: 1,
        homeTeam: { id: "t5", name: "E", shortName: null, tla: null, crest: null },
        awayTeam: { id: "t6", name: "F", shortName: null, tla: null, crest: null },
      },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(data.matchDays).toEqual([5, 3, 1]);
  });

  it("supports matchDay filtering via query param", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", visibility: "PUBLIC" });
    mockPrisma.match.findMany.mockResolvedValue([]);
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results?matchDay=2");
    const res = await GET(req, routeParams);

    expect(res.status).toBe(200);
    // Call order: (0) allContestMatches for active group, (1) allPlayedMatches for rounds,
    // (2) main filtered matches query
    const matchWhereCall = mockPrisma.match.findMany.mock.calls[2][0].where;
    expect(matchWhereCall.matchDay).toBe(2);
  });
});
