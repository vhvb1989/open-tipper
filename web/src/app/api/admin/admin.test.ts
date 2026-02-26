import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock prisma
const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  contest: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

// Mock football API
const mockListLeagues = vi.fn();
vi.mock("@/lib/football-api", () => {
  return {
    FootballApiClient: class {
      listLeagues = mockListLeagues;
    },
  };
});

// Mock sync
const mockSyncCompetition = vi.fn();
vi.mock("@/lib/sync", () => ({
  syncCompetition: (...args: unknown[]) => mockSyncCompetition(...args),
}));

// Helper to create admin/non-admin sessions
const adminSession = { user: { id: "admin-1", role: "ADMIN" } };
const userSession = { user: { id: "user-1", role: "USER" } };

describe("Admin API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/competitions
  // -----------------------------------------------------------------------
  describe("GET /api/admin/competitions", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { GET } = await import("@/app/api/admin/competitions/route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      mockAuth.mockResolvedValue(userSession);
      const { GET } = await import("@/app/api/admin/competitions/route");
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns competitions list for admin", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockListLeagues.mockResolvedValue({
        get: "leagues",
        parameters: {},
        errors: [],
        results: 1,
        paging: { current: 1, total: 1 },
        response: [
          {
            league: { id: 39, name: "Premier League", type: "League", logo: null },
            country: {
              name: "England",
              code: "GB",
              flag: "https://media.api-sports.io/flags/gb.svg",
            },
            seasons: [
              { year: 2025, start: "2025-08-01", end: "2026-05-31", current: true, coverage: {} },
            ],
          },
        ],
      });
      mockPrisma.contest.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/admin/competitions/route");
      const res = await GET();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.competitions).toHaveLength(1);
      expect(data.competitions[0].leagueId).toBe(39);
      expect(data.competitions[0].synced).toBe(false);
    });

    it("marks already synced competitions", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockListLeagues.mockResolvedValue({
        get: "leagues",
        parameters: {},
        errors: [],
        results: 1,
        paging: { current: 1, total: 1 },
        response: [
          {
            league: { id: 2, name: "Champions League", type: "Cup", logo: null },
            country: { name: "World", code: null, flag: null },
            seasons: [
              { year: 2025, start: "2025-09-01", end: "2026-06-01", current: true, coverage: {} },
            ],
          },
        ],
      });
      mockPrisma.contest.findMany.mockResolvedValue([
        { id: "c1", code: "2", season: "2025", name: "Champions League", status: "ACTIVE" },
      ]);

      const { GET } = await import("@/app/api/admin/competitions/route");
      const res = await GET();
      const data = await res.json();

      expect(data.competitions[0].synced).toBe(true);
      expect(data.localContests).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/admin/sync
  // -----------------------------------------------------------------------
  describe("POST /api/admin/sync", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { POST } = await import("@/app/api/admin/sync/route");
      const req = new NextRequest("http://localhost:3000/api/admin/sync", {
        method: "POST",
        body: JSON.stringify({ leagueId: 2 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      mockAuth.mockResolvedValue(userSession);
      const { POST } = await import("@/app/api/admin/sync/route");
      const req = new NextRequest("http://localhost:3000/api/admin/sync", {
        method: "POST",
        body: JSON.stringify({ leagueId: 2 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("returns 400 when leagueId is missing", async () => {
      mockAuth.mockResolvedValue(adminSession);
      const { POST } = await import("@/app/api/admin/sync/route");
      const req = new NextRequest("http://localhost:3000/api/admin/sync", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("syncs a competition successfully", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockSyncCompetition.mockResolvedValue({
        contestId: "c1",
        teamsUpserted: 20,
        matchesUpserted: 100,
        predictionsScored: 0,
      });

      const { POST } = await import("@/app/api/admin/sync/route");
      const req = new NextRequest("http://localhost:3000/api/admin/sync", {
        method: "POST",
        body: JSON.stringify({ leagueId: 39 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.result.teamsUpserted).toBe(20);
      expect(data.result.matchesUpserted).toBe(100);
    });

    it("returns 500 when sync fails", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockSyncCompetition.mockRejectedValue(new Error("API rate limit"));

      const { POST } = await import("@/app/api/admin/sync/route");
      const req = new NextRequest("http://localhost:3000/api/admin/sync", {
        method: "POST",
        body: JSON.stringify({ leagueId: 39 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("API rate limit");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/users
  // -----------------------------------------------------------------------
  describe("GET /api/admin/users", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { GET } = await import("@/app/api/admin/users/route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      mockAuth.mockResolvedValue(userSession);
      const { GET } = await import("@/app/api/admin/users/route");
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns users list for admin", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "admin-1",
          name: "Admin",
          email: "admin@test.com",
          image: null,
          role: "ADMIN",
          createdAt: new Date(),
        },
        {
          id: "user-2",
          name: "User",
          email: "user@test.com",
          image: null,
          role: "USER",
          createdAt: new Date(),
        },
      ]);

      const { GET } = await import("@/app/api/admin/users/route");
      const res = await GET();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.users).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /api/admin/users/:id
  // -----------------------------------------------------------------------
  describe("PATCH /api/admin/users/:id", () => {
    const routeParams = { params: Promise.resolve({ id: "user-2" }) };

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { PATCH } = await import("@/app/api/admin/users/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ role: "ADMIN" }),
      });
      const res = await PATCH(req, routeParams);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      mockAuth.mockResolvedValue(userSession);
      const { PATCH } = await import("@/app/api/admin/users/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ role: "ADMIN" }),
      });
      const res = await PATCH(req, routeParams);
      expect(res.status).toBe(403);
    });

    it("prevents admin from changing own role", async () => {
      mockAuth.mockResolvedValue(adminSession);
      const selfParams = { params: Promise.resolve({ id: "admin-1" }) };
      const { PATCH } = await import("@/app/api/admin/users/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/admin/users/admin-1", {
        method: "PATCH",
        body: JSON.stringify({ role: "USER" }),
      });
      const res = await PATCH(req, selfParams);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("own role");
    });

    it("returns 400 for invalid role", async () => {
      mockAuth.mockResolvedValue(adminSession);
      const { PATCH } = await import("@/app/api/admin/users/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ role: "SUPERADMIN" }),
      });
      const res = await PATCH(req, routeParams);
      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const { PATCH } = await import("@/app/api/admin/users/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ role: "ADMIN" }),
      });
      const res = await PATCH(req, routeParams);
      expect(res.status).toBe(404);
    });

    it("promotes user to admin", async () => {
      mockAuth.mockResolvedValue(adminSession);
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", role: "USER" });
      mockPrisma.user.update.mockResolvedValue({
        id: "user-2",
        name: "User",
        email: "user@test.com",
        role: "ADMIN",
      });

      const { PATCH } = await import("@/app/api/admin/users/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ role: "ADMIN" }),
      });
      const res = await PATCH(req, routeParams);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user.role).toBe("ADMIN");
    });
  });
});
