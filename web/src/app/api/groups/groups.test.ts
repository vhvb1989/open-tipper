import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock prisma
const mockPrisma = {
  group: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  contest: {
    findUnique: vi.fn(),
  },
  membership: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  scoringRules: {
    upsert: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("Groups API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/groups", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { GET } = await import("@/app/api/groups/route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns user's groups when authenticated", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.group.findMany.mockResolvedValue([
        {
          id: "group-1",
          name: "Test Group",
          description: null,
          visibility: "PRIVATE",
          createdAt: new Date(),
          contest: {
            id: "c1",
            name: "Champions League",
            code: "CL",
            season: "2025/26",
            emblem: null,
          },
          _count: { memberships: 2 },
          memberships: [{ role: "ADMIN" }],
        },
      ]);

      const { GET } = await import("@/app/api/groups/route");
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.groups).toHaveLength(1);
      expect(data.groups[0].name).toBe("Test Group");
      expect(data.groups[0].role).toBe("ADMIN");
      expect(data.groups[0].memberCount).toBe(2);
    });
  });

  describe("POST /api/groups", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { POST } = await import("@/app/api/groups/route");
      const req = new NextRequest("http://localhost:3000/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "Test", contestId: "c1" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      const { POST } = await import("@/app/api/groups/route");
      const req = new NextRequest("http://localhost:3000/api/groups", {
        method: "POST",
        body: JSON.stringify({ contestId: "c1" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 when contest doesn't exist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.contest.findUnique.mockResolvedValue(null);

      const { POST } = await import("@/app/api/groups/route");
      const req = new NextRequest("http://localhost:3000/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "Test Group", contestId: "bad-id" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it("creates group with default scoring rules", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.contest.findUnique.mockResolvedValue({ id: "c1" });
      mockPrisma.group.create.mockResolvedValue({
        id: "group-1",
        name: "Test Group",
        contest: { id: "c1", name: "CL", code: "CL", season: "2025" },
        _count: { memberships: 1 },
      });

      const { POST } = await import("@/app/api/groups/route");
      const req = new NextRequest("http://localhost:3000/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "Test Group", contestId: "c1" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(201);
      expect(mockPrisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Test Group",
            contestId: "c1",
            visibility: "PRIVATE",
            memberships: {
              create: { userId: "user-1", role: "ADMIN" },
            },
            scoringRules: {
              create: expect.objectContaining({
                exactScore: 10,
                goalDifference: 6,
                outcome: 4,
                accumulationMode: "ACCUMULATE",
              }),
            },
          }),
        }),
      );
    });
  });

  describe("GET /api/groups/:id", () => {
    it("returns 404 when group not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.group.findUnique.mockResolvedValue(null);

      const { GET } = await import("@/app/api/groups/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/groups/bad-id");
      const res = await GET(req, { params: Promise.resolve({ id: "bad-id" }) });
      expect(res.status).toBe(404);
    });

    it("returns 404 for private group when not a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "g1",
        name: "Private Group",
        description: null,
        visibility: "PRIVATE",
        inviteCode: "abc",
        createdAt: new Date(),
        contest: {
          id: "c1",
          name: "CL",
          code: "CL",
          season: "2025",
          emblem: null,
          status: "ACTIVE",
        },
        scoringRules: null,
        _count: { memberships: 1 },
        memberships: [], // not a member
      });

      const { GET } = await import("@/app/api/groups/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/groups/:id", () => {
    it("returns 403 for non-admin members", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({
        userId: "user-1",
        groupId: "g1",
        role: "MEMBER",
      });

      const { DELETE } = await import("@/app/api/groups/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("deletes group when admin", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({
        userId: "user-1",
        groupId: "g1",
        role: "ADMIN",
      });
      mockPrisma.group.delete.mockResolvedValue({});

      const { DELETE } = await import("@/app/api/groups/[id]/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(200);
      expect(mockPrisma.group.delete).toHaveBeenCalledWith({
        where: { id: "g1" },
      });
    });
  });

  describe("POST /api/groups/:id/join", () => {
    it("returns 409 when already a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "g1",
        visibility: "PUBLIC",
        inviteCode: "abc",
      });
      mockPrisma.membership.findUnique.mockResolvedValue({
        userId: "user-1",
        groupId: "g1",
      });

      const { POST } = await import("@/app/api/groups/[id]/join/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1/join", {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(409);
    });

    it("requires invite code for private groups", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "g1",
        visibility: "PRIVATE",
        inviteCode: "correct-code",
      });
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      const { POST } = await import("@/app/api/groups/[id]/join/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: "wrong-code" }),
      });
      const res = await POST(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/groups/:id/leave", () => {
    it("prevents admin from leaving", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: "m1",
        userId: "user-1",
        groupId: "g1",
        role: "ADMIN",
      });

      const { POST } = await import("@/app/api/groups/[id]/leave/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1/leave", {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(400);
    });

    it("allows member to leave", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-2" } });
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: "m2",
        userId: "user-2",
        groupId: "g1",
        role: "MEMBER",
      });
      mockPrisma.membership.delete.mockResolvedValue({});

      const { POST } = await import("@/app/api/groups/[id]/leave/route");
      const req = new NextRequest("http://localhost:3000/api/groups/g1/leave", {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(200);
    });
  });
});
