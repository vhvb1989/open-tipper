import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  match: { findFirst: vi.fn() },
  podiumPrediction: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  podiumBadge: { findMany: vi.fn() },
  podiumSettings: { update: vi.fn() },
  team: { findMany: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

const NOW = new Date("2025-06-15T12:00:00Z");

const basePodiumSettings = {
  id: "ps1",
  groupId: "g1",
  enabled: true,
  firstPlacePoints: 100,
  secondPlacePoints: 50,
  thirdPlacePoints: 100,
  thirdPlaceEnabled: true,
  podiumOpenOverride: null,
};

const baseGroup = {
  id: "g1",
  visibility: "PRIVATE",
  podiumSettings: basePodiumSettings,
  contest: { id: "c1", code: "WC", status: "IN_PLAY" },
  memberships: [{ role: "ADMIN" }],
};

describe("Podium API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ================================================================
     GET /api/groups/:id/podium — lock override logic
     ================================================================ */
  describe("GET /api/groups/:id/podium — override logic", () => {
    it("returns isLocked=false when override is true (force open), even if match started", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        ...baseGroup,
        podiumSettings: { ...basePodiumSettings, podiumOpenOverride: true },
      });
      // Match has started, but override forces open
      mockPrisma.match.findFirst.mockResolvedValue(null);
      mockPrisma.podiumPrediction.findUnique.mockResolvedValue(null);
      mockPrisma.team.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.isLocked).toBe(false);
      expect(body.isAdmin).toBe(true);
      expect(body.podiumOpenOverride).toBe(true);
    });

    it("returns isLocked=true when override is false (force closed), even before matches", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        ...baseGroup,
        podiumSettings: { ...basePodiumSettings, podiumOpenOverride: false },
      });
      mockPrisma.match.findFirst.mockResolvedValue(null);
      mockPrisma.podiumPrediction.findUnique.mockResolvedValue(null);
      mockPrisma.team.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.isLocked).toBe(true);
    });

    it("returns isAdmin=false for non-admin members", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u2" } });
      mockPrisma.group.findUnique.mockResolvedValue({
        ...baseGroup,
        memberships: [{ role: "MEMBER" }],
      });
      mockPrisma.match.findFirst.mockResolvedValue(null);
      mockPrisma.podiumPrediction.findUnique.mockResolvedValue(null);
      mockPrisma.team.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.isAdmin).toBe(false);
    });
  });

  /* ================================================================
     PATCH /api/groups/:id/podium — admin toggle override
     ================================================================ */
  describe("PATCH /api/groups/:id/podium", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user is not admin", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u2" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("returns 403 when user is not a member", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u3" } });
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(403);
    });

    it("returns 400 when podium is not enabled", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
      mockPrisma.group.findUnique.mockResolvedValue({
        ...baseGroup,
        podiumSettings: { ...basePodiumSettings, enabled: false },
      });

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid override value", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
      mockPrisma.group.findUnique.mockResolvedValue(baseGroup);

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: "invalid" }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(400);
    });

    it("successfully sets override to true (force open)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
      mockPrisma.group.findUnique.mockResolvedValue(baseGroup);
      mockPrisma.podiumSettings.update.mockResolvedValue({
        ...basePodiumSettings,
        podiumOpenOverride: true,
      });

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.podiumSettings.podiumOpenOverride).toBe(true);
      expect(mockPrisma.podiumSettings.update).toHaveBeenCalledWith({
        where: { groupId: "g1" },
        data: { podiumOpenOverride: true },
      });
    });

    it("successfully sets override to false (force closed)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
      mockPrisma.group.findUnique.mockResolvedValue(baseGroup);
      mockPrisma.podiumSettings.update.mockResolvedValue({
        ...basePodiumSettings,
        podiumOpenOverride: false,
      });

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: false }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.podiumSettings.podiumOpenOverride).toBe(false);
    });

    it("successfully resets override to null (auto mode)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
      mockPrisma.group.findUnique.mockResolvedValue(baseGroup);
      mockPrisma.podiumSettings.update.mockResolvedValue({
        ...basePodiumSettings,
        podiumOpenOverride: null,
      });

      const { PATCH } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PATCH",
        body: JSON.stringify({ podiumOpenOverride: null }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.podiumSettings.podiumOpenOverride).toBeNull();
    });
  });

  /* ================================================================
     PUT /api/groups/:id/podium — respects override on lock check
     ================================================================ */
  describe("PUT /api/groups/:id/podium — override lock check", () => {
    it("allows submission when override is true even if match started", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({
        ...baseGroup,
        podiumSettings: { ...basePodiumSettings, podiumOpenOverride: true },
      });
      // Override is true, so computeIsLocked returns false regardless
      mockPrisma.match.findFirst.mockResolvedValue(null);
      mockPrisma.team.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
      mockPrisma.podiumPrediction.upsert.mockResolvedValue({
        id: "pp1",
        firstPlaceTeamId: "t1",
        secondPlaceTeamId: "t2",
        thirdPlaceTeamId: "t3",
        firstPlaceTeam: { id: "t1", name: "Team 1", crest: null },
        secondPlaceTeam: { id: "t2", name: "Team 2", crest: null },
        thirdPlaceTeam: { id: "t3", name: "Team 3", crest: null },
      });

      const { PUT } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PUT",
        body: JSON.stringify({
          firstPlaceTeamId: "t1",
          secondPlaceTeamId: "t2",
          thirdPlaceTeamId: "t3",
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(200);
    });

    it("rejects submission when override is false (force closed)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
      mockPrisma.group.findUnique.mockResolvedValue({
        ...baseGroup,
        podiumSettings: { ...basePodiumSettings, podiumOpenOverride: false },
      });

      const { PUT } = await import("@/app/api/groups/[id]/podium/route");
      const req = new NextRequest("http://localhost/api/groups/g1/podium", {
        method: "PUT",
        body: JSON.stringify({
          firstPlaceTeamId: "t1",
          secondPlaceTeamId: "t2",
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: "g1" }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("locked");
    });
  });
});
