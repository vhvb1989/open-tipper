import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  group: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  contest: {
    findFirst: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

const makePost = (groupId: string, body: unknown) =>
  new NextRequest(`http://localhost/api/groups/${groupId}/new-season`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const sourceGroup = {
  id: "g1",
  description: "desc",
  visibility: "PRIVATE",
  riskEnabled: true,
  contest: { id: "c1", code: "262", season: "2025" },
  scoringRules: {
    exactScore: 12,
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
  podiumSettings: null,
  memberships: [
    { userId: "u1", role: "ADMIN" },
    { userId: "u2", role: "MEMBER" },
  ],
};

describe("POST /api/groups/:id/new-season", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", { name: "Liga MX 2026" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", {}), { params: Promise.resolve({ id: "g1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when source group not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockPrisma.group.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", { name: "New" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when requester is not an admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockPrisma.group.findUnique.mockResolvedValue(sourceGroup);
    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", { name: "New" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no new season contest is available", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockPrisma.group.findUnique.mockResolvedValue(sourceGroup);
    mockPrisma.contest.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", { name: "New" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 with the existing group when already rolled over", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockPrisma.group.findUnique.mockResolvedValue(sourceGroup);
    mockPrisma.contest.findFirst.mockResolvedValue({ id: "c2", season: "2026" });
    mockPrisma.group.findFirst.mockResolvedValue({ id: "g2", name: "Liga MX 2026" });
    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", { name: "New" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.group).toEqual({ id: "g2", name: "Liga MX 2026" });
  });

  it("clones the group into the new season, copying members and settings", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockPrisma.group.findUnique.mockResolvedValue(sourceGroup);
    mockPrisma.contest.findFirst.mockResolvedValue({ id: "c2", season: "2026" });
    mockPrisma.group.findFirst.mockResolvedValue(null);
    mockPrisma.group.create.mockResolvedValue({ id: "g2", name: "Liga MX 2026" });

    const { POST } = await import("@/app/api/groups/[id]/new-season/route");
    const res = await POST(makePost("g1", { name: "Liga MX 2026" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(201);

    const data = mockPrisma.group.create.mock.calls[0][0].data;
    expect(data.name).toBe("Liga MX 2026");
    expect(data.contestId).toBe("c2");
    expect(data.previousGroupId).toBe("g1");
    expect(data.riskEnabled).toBe(true);
    expect(data.memberships.create).toEqual([
      { userId: "u1", role: "ADMIN" },
      { userId: "u2", role: "MEMBER" },
    ]);
    expect(data.scoringRules.create.exactScore).toBe(12);
  });
});
