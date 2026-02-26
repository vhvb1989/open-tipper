import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock prisma
const mockPrisma = {
  group: { findMany: vi.fn(), findUnique: vi.fn() },
  contest: { findMany: vi.fn() },
  membership: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  prediction: { findMany: vi.fn() },
  match: { findMany: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

/* ================================================================
   BROWSE API — GET /api/groups/browse
   ================================================================ */
describe("Browse Groups API — GET /api/groups/browse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public groups without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    mockPrisma.group.findMany.mockResolvedValue([
      {
        id: "g1",
        name: "Public League",
        description: "Open to all",
        contest: { id: "c1", name: "Premier League", code: "PL", season: "2025/26", emblem: null },
        _count: { memberships: 5 },
        memberships: [{ user: { id: "u1", name: "Admin User", image: null } }],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    mockPrisma.contest.findMany.mockResolvedValue([
      { id: "c1", name: "Premier League", code: "PL", season: "2025/26" },
    ]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest("http://localhost:3000/api/groups/browse");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].name).toBe("Public League");
    expect(data.groups[0].memberCount).toBe(5);
    expect(data.groups[0].admin.name).toBe("Admin User");
    expect(data.groups[0].isMember).toBe(false);
    expect(data.contests).toHaveLength(1);
  });

  it("returns isMember=true for groups the user has joined", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.group.findMany.mockResolvedValue([
      {
        id: "g1",
        name: "My Group",
        description: null,
        contest: { id: "c1", name: "CL", code: "CL", season: "2025/26", emblem: null },
        _count: { memberships: 3 },
        memberships: [{ user: { id: "user-1", name: "Me", image: null } }],
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "g2",
        name: "Other Group",
        description: null,
        contest: { id: "c1", name: "CL", code: "CL", season: "2025/26", emblem: null },
        _count: { memberships: 5 },
        memberships: [{ user: { id: "u2", name: "Someone", image: null } }],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    mockPrisma.membership.findMany.mockResolvedValue([{ groupId: "g1" }]);
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest("http://localhost:3000/api/groups/browse");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groups[0].isMember).toBe(true);
    expect(data.groups[1].isMember).toBe(false);
  });

  it("filters by search query (case-insensitive)", async () => {
    mockPrisma.group.findMany.mockResolvedValue([]);
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest("http://localhost:3000/api/groups/browse?search=Premier");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "PUBLIC",
          name: { contains: "Premier", mode: "insensitive" },
        }),
      }),
    );
  });

  it("filters by contestId", async () => {
    mockPrisma.group.findMany.mockResolvedValue([]);
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest("http://localhost:3000/api/groups/browse?contestId=c1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "PUBLIC",
          contestId: "c1",
        }),
      }),
    );
  });

  it("filters by both search and contestId", async () => {
    mockPrisma.group.findMany.mockResolvedValue([]);
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest(
      "http://localhost:3000/api/groups/browse?search=League&contestId=c2",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "PUBLIC",
          name: { contains: "League", mode: "insensitive" },
          contestId: "c2",
        }),
      }),
    );
  });

  it("returns empty array when no public groups exist", async () => {
    mockPrisma.group.findMany.mockResolvedValue([]);
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest("http://localhost:3000/api/groups/browse");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groups).toHaveLength(0);
    expect(data.contests).toHaveLength(0);
  });

  it("handles group with no admin membership gracefully", async () => {
    mockPrisma.group.findMany.mockResolvedValue([
      {
        id: "g1",
        name: "Orphan Group",
        description: null,
        contest: { id: "c1", name: "CL", code: "CL", season: "2025/26", emblem: null },
        _count: { memberships: 0 },
        memberships: [],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/groups/browse/route");
    const req = new NextRequest("http://localhost:3000/api/groups/browse");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groups[0].admin).toBeNull();
  });
});

/* ================================================================
   PUBLIC GROUP ACCESS — Standings & Results without membership
   ================================================================ */
describe("Public Group Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Standings — public group visible without auth", () => {
    const routeParams = { params: Promise.resolve({ id: "public-group" }) };

    it("allows unauthenticated access to public group standings", async () => {
      mockAuth.mockResolvedValue(null);

      mockPrisma.group.findUnique.mockResolvedValue({
        contestId: "c1",
        visibility: "PUBLIC",
      });
      mockPrisma.membership.findMany.mockResolvedValue([
        { user: { id: "u1", name: "Alice", image: null }, role: "ADMIN" },
      ]);
      mockPrisma.prediction.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/groups/[id]/standings/route");
      const req = new NextRequest("http://localhost:3000/api/groups/public-group/standings");
      const res = await GET(req, routeParams);

      expect(res.status).toBe(200);
    });
  });

  describe("Standings — private group requires membership", () => {
    const routeParams = { params: Promise.resolve({ id: "private-group" }) };

    it("returns 401 for unauthenticated access to private group standings", async () => {
      mockAuth.mockResolvedValue(null);

      mockPrisma.group.findUnique.mockResolvedValue({
        contestId: "c1",
        visibility: "PRIVATE",
      });

      const { GET } = await import("@/app/api/groups/[id]/standings/route");
      const req = new NextRequest("http://localhost:3000/api/groups/private-group/standings");
      const res = await GET(req, routeParams);

      expect(res.status).toBe(401);
    });
  });

  describe("Join — public group join flow", () => {
    const routeParams = { params: Promise.resolve({ id: "public-group" }) };

    it("allows joining a public group without invite code", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      mockPrisma.group.findUnique.mockResolvedValue({
        id: "public-group",
        visibility: "PUBLIC",
        inviteCode: "xxx",
      });
      mockPrisma.membership.findUnique.mockResolvedValue(null); // not already a member
      mockPrisma.membership.create.mockResolvedValue({
        userId: "user-1",
        groupId: "public-group",
        role: "MEMBER",
      });

      const { POST } = await import("@/app/api/groups/[id]/join/route");
      const req = new NextRequest("http://localhost:3000/api/groups/public-group/join", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req, routeParams);

      expect(res.status).toBe(201);
    });

    it("returns 409 when already a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      mockPrisma.group.findUnique.mockResolvedValue({
        id: "public-group",
        visibility: "PUBLIC",
        inviteCode: "xxx",
      });
      mockPrisma.membership.findUnique.mockResolvedValue({
        userId: "user-1",
        groupId: "public-group",
      });

      const { POST } = await import("@/app/api/groups/[id]/join/route");
      const req = new NextRequest("http://localhost:3000/api/groups/public-group/join", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req, routeParams);

      expect(res.status).toBe(409);
    });

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { POST } = await import("@/app/api/groups/[id]/join/route");
      const req = new NextRequest("http://localhost:3000/api/groups/public-group/join", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req, routeParams);

      expect(res.status).toBe(401);
    });
  });
});
