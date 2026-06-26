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
  match: { findMany: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

const routeParams = { params: Promise.resolve({ id: "group-1" }) };

function makeMatch(id: string, matchDay: number, kickoff: string) {
  return {
    id,
    matchDay,
    stage: null,
    kickoffTime: new Date(kickoff),
    homeGoals: 1,
    awayGoals: 0,
    homeTeam: { name: "Home", shortName: "HOM", crest: null },
    awayTeam: { name: "Away", shortName: "AWY", crest: null },
  };
}

describe("Trajectory API — GET /api/groups/:id/trajectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ userId: "user-1", groupId: "group-1" });
    mockPrisma.membership.findMany.mockResolvedValue([
      { user: { id: "user-1", name: "Alice", image: null } },
    ]);
    mockPrisma.riskPrediction.findMany.mockResolvedValue([]);
  });

  it("includes won/lost risk-it deltas in cumulative points", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", riskEnabled: true });
    mockPrisma.match.findMany.mockResolvedValue([
      makeMatch("m1", 1, "2025-01-01T18:00:00Z"),
      makeMatch("m2", 2, "2025-01-02T18:00:00Z"),
    ]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        matchId: "m1",
        userId: "user-1",
        homeGoals: 1,
        awayGoals: 0,
        pointsAwarded: 5,
        bonusPoints: 2,
      },
      {
        matchId: "m2",
        userId: "user-1",
        homeGoals: 1,
        awayGoals: 0,
        pointsAwarded: 3,
        bonusPoints: 0,
      },
    ]);
    // m1: WON risk, stake 4, payout 12 => net +8
    // m2: LOST risk, stake 6 => net -6
    mockPrisma.riskPrediction.findMany.mockResolvedValue([
      { matchId: "m1", userId: "user-1", status: "WON", pointsRisked: 4, pointsAwarded: 12 },
      { matchId: "m2", userId: "user-1", status: "LOST", pointsRisked: 6, pointsAwarded: 0 },
    ]);

    const { GET } = await import("@/app/api/groups/[id]/trajectory/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/trajectory");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    // m1: base 5+2=7, risk +8 => matchPoints 15, cumulative 15
    expect(data.trajectory[0].users["user-1"].matchPoints).toBe(15);
    expect(data.trajectory[0].users["user-1"].cumulative).toBe(15);
    // m2: base 3, risk -6 => matchPoints -3, cumulative 12
    expect(data.trajectory[1].users["user-1"].matchPoints).toBe(-3);
    expect(data.trajectory[1].users["user-1"].cumulative).toBe(12);
  });

  it("ignores risk-it points when risk is disabled for the group", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c-1", riskEnabled: false });
    mockPrisma.match.findMany.mockResolvedValue([makeMatch("m1", 1, "2025-01-01T18:00:00Z")]);
    mockPrisma.prediction.findMany.mockResolvedValue([
      {
        matchId: "m1",
        userId: "user-1",
        homeGoals: 1,
        awayGoals: 0,
        pointsAwarded: 5,
        bonusPoints: 0,
      },
    ]);

    const { GET } = await import("@/app/api/groups/[id]/trajectory/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/trajectory");
    const res = await GET(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.riskPrediction.findMany).not.toHaveBeenCalled();
    expect(data.trajectory[0].users["user-1"].cumulative).toBe(5);
  });
});
