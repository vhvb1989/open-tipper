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
  match: { findMany: vi.fn() },
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
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/groups/[id]/standings/route");

    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(403);
  });

  it("returns 404 when group does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(404);
  });

  it("returns empty standings when no predictions are scored", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([]);

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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
      { user: { id: "user-3", name: "Charlie", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      // Alice: 10 + 5 = 15 total, MD1 + MD2
      { userId: "user-1", pointsAwarded: 10, match: { matchDay: 1 } },
      { userId: "user-1", pointsAwarded: 5, match: { matchDay: 2 } },
      // Bob: 20 total, MD1
      { userId: "user-2", pointsAwarded: 20, match: { matchDay: 1 } },
      // Charlie: 3 total, MD2
      { userId: "user-3", pointsAwarded: 3, match: { matchDay: 2 } },
    ]);

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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
      { user: { id: "user-2", name: "Bob", image: null }, role: "MEMBER" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      // Both have 10 points total
      { userId: "user-1", pointsAwarded: 5, match: { matchDay: 1 } },
      { userId: "user-1", pointsAwarded: 5, match: { matchDay: 2 } },
      { userId: "user-2", pointsAwarded: 10, match: { matchDay: 1 } },
    ]);

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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "user-1", pointsAwarded: 10, match: { matchDay: 1 } },
      { userId: "user-1", pointsAwarded: 7, match: { matchDay: 2 } },
      { userId: "user-1", pointsAwarded: 3, match: { matchDay: 3 } },
    ]);

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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "user-1", pointsAwarded: 10, match: { matchDay: 1 } },
      { userId: "user-1", pointsAwarded: 7, match: { matchDay: 2 } },
    ]);

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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null }, role: "ADMIN" },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      { userId: "user-1", pointsAwarded: 5, match: { matchDay: 3 } },
      { userId: "user-1", pointsAwarded: 5, match: { matchDay: 1 } },
      { userId: "user-1", pointsAwarded: 5, match: { matchDay: 5 } },
    ]);

    const { GET } = await import("@/app/api/groups/[id]/standings/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/standings");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(data.matchDays).toEqual([1, 3, 5]);
  });
});

/* ================================================================
   RESULTS TESTS
   ================================================================ */
describe("Results API — GET /api/groups/:id/results", () => {
  const routeParams = { params: Promise.resolve({ id: "group-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/groups/[id]/results/route");

    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(403);
  });

  it("returns 404 when group does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results");
    const res = await GET(req, routeParams);
    expect(res.status).toBe(404);
  });

  it("returns empty results when no finished matches", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "match-1",
        matchDay: 1,
        stage: "GROUP_STAGE",
        kickoffTime: new Date("2025-06-01T18:00:00Z"),
        homeGoals: 2,
        awayGoals: 1,
        homeTeam: { id: "t1", name: "Team A", shortName: "TMA", tla: "TMA", crest: null },
        awayTeam: { id: "t2", name: "Team B", shortName: "TMB", tla: "TMB", crest: null },
      },
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        homeGoals: 2,
        awayGoals: 1,
        pointsAwarded: 25,
        user: { id: "user-1", name: "Alice", image: null },
      },
      {
        matchId: "match-1",
        homeGoals: 1,
        awayGoals: 0,
        pointsAwarded: 8,
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
  });

  it("returns empty predictions array for matches with no tips", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "m1", matchDay: 1, stage: null, kickoffTime: new Date(), homeGoals: 1, awayGoals: 0,
        homeTeam: { id: "t1", name: "A", shortName: null, tla: null, crest: null },
        awayTeam: { id: "t2", name: "B", shortName: null, tla: null, crest: null },
      },
      {
        id: "m2", matchDay: 3, stage: null, kickoffTime: new Date(), homeGoals: 2, awayGoals: 2,
        homeTeam: { id: "t3", name: "C", shortName: null, tla: null, crest: null },
        awayTeam: { id: "t4", name: "D", shortName: null, tla: null, crest: null },
      },
      {
        id: "m3", matchDay: 5, stage: null, kickoffTime: new Date(), homeGoals: 0, awayGoals: 1,
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
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1" });
    mockPrisma.match.findMany.mockResolvedValue([]);
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/[id]/results/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/results?matchDay=2");
    const res = await GET(req, routeParams);

    expect(res.status).toBe(200);
    // First findMany call is for matchDays, second is the filtered matches query
    const matchWhereCall = mockPrisma.match.findMany.mock.calls[1][0].where;
    expect(matchWhereCall.matchDay).toBe(2);
  });
});
