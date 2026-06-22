import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MatchStatus, RiskCategory, RiskStatus } from "@/generated/prisma/client";

const mockAuth = vi.fn();
const mockGetAvailableBalance = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  group: { findUnique: vi.fn() },
  match: { findUnique: vi.fn() },
  membership: { findUnique: vi.fn() },
  riskPrediction: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/risk-balance", () => ({
  getAvailableBalance: (...args: unknown[]) => mockGetAvailableBalance(...args),
}));

const NOW = new Date("2025-06-15T12:00:00Z");

describe("Risk predictions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
    mockGetAvailableBalance.mockResolvedValue(100);
    // $transaction executes the callback with the same mock prisma
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("GET /api/groups/:id/predictions/risk", () => {
    it("returns the current user's risks keyed by matchId with balance", async () => {
      mockPrisma.riskPrediction.findMany.mockResolvedValue([
        {
          id: "r1",
          userId: "u1",
          groupId: "g1",
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 5,
          pointsRisked: 3,
          status: RiskStatus.PENDING,
          pointsAwarded: null,
          createdAt: NOW,
          resolvedAt: null,
        },
        {
          id: "r2",
          userId: "u1",
          groupId: "g1",
          matchId: "m1",
          category: RiskCategory.CORNER_KICKS,
          predictedValue: 9,
          pointsRisked: 4,
          status: RiskStatus.CANCELLED,
          pointsAwarded: null,
          createdAt: NOW,
          resolvedAt: NOW,
        },
        {
          id: "r3",
          userId: "u1",
          groupId: "g1",
          matchId: "m2",
          category: RiskCategory.RED_CARDS,
          predictedValue: 1,
          pointsRisked: 2,
          status: RiskStatus.WON,
          pointsAwarded: 4,
          createdAt: NOW,
          resolvedAt: NOW,
        },
      ]);

      const { GET } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/risk");
      const res = await GET(req, { params: Promise.resolve({ id: "g1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.balance).toBe(100);
      expect(body.risks.m1).toHaveLength(2);
      expect(body.risks.m2).toHaveLength(1);
      expect(body.risks.m1[0]).toMatchObject({
        id: "r1",
        category: RiskCategory.YELLOW_CARDS,
        predictedValue: 5,
        pointsRisked: 3,
        status: RiskStatus.PENDING,
      });
      expect(mockPrisma.riskPrediction.findMany).toHaveBeenCalledWith({
        where: { userId: "u1", groupId: "g1" },
        orderBy: [{ matchId: "asc" }, { createdAt: "asc" }],
      });
    });
  });

  describe("PUT /api/groups/:id/predictions/risk", () => {
    const makeRequest = (body: Record<string, unknown>) =>
      new NextRequest("http://localhost/api/groups/g1/predictions/risk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("creates a risk prediction successfully", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-16T12:00:00Z"),
        status: MatchStatus.SCHEDULED,
      });
      mockPrisma.riskPrediction.findUnique.mockResolvedValue(null);
      mockPrisma.riskPrediction.create.mockResolvedValue({
        id: "r1",
        userId: "u1",
        groupId: "g1",
        matchId: "m1",
        category: RiskCategory.YELLOW_CARDS,
        predictedValue: 4,
        pointsRisked: 5,
        status: RiskStatus.PENDING,
        pointsAwarded: null,
        createdAt: NOW,
        resolvedAt: null,
      });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.riskPrediction).toMatchObject({
        id: "r1",
        matchId: "m1",
        category: RiskCategory.YELLOW_CARDS,
        predictedValue: 4,
        pointsRisked: 5,
        status: RiskStatus.PENDING,
      });
      expect(body.balance).toBe(95);
      expect(mockGetAvailableBalance).toHaveBeenCalledWith("u1", "g1", mockPrisma);
      expect(mockPrisma.riskPrediction.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          groupId: "g1",
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked: 5,
          status: RiskStatus.PENDING,
        },
      });
    });

    it("rejects when risk predictions are not enabled for the group", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: false });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(400);
    });

    it("rejects when the match has already started", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-15T11:00:00Z"),
        status: MatchStatus.IN_PLAY,
      });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(403);
    });

    it("rejects when the user has insufficient balance", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-16T12:00:00Z"),
        status: MatchStatus.SCHEDULED,
      });
      mockPrisma.riskPrediction.findUnique.mockResolvedValue(null);
      mockGetAvailableBalance.mockResolvedValue(4);

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(400);
    });

    it("accepts a red-card prediction of 0 (no card)", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-16T12:00:00Z"),
        status: MatchStatus.SCHEDULED,
      });
      mockPrisma.riskPrediction.findUnique.mockResolvedValue(null);
      mockPrisma.riskPrediction.create.mockResolvedValue({
        id: "r-red",
        userId: "u1",
        groupId: "g1",
        matchId: "m1",
        category: RiskCategory.RED_CARDS,
        predictedValue: 0,
        pointsRisked: 5,
        status: RiskStatus.PENDING,
        pointsAwarded: null,
        createdAt: NOW,
        resolvedAt: null,
      });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.RED_CARDS,
          predictedValue: 0,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(200);
    });

    it("rejects a red-card prediction other than 0 or 1", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.RED_CARDS,
          predictedValue: 2,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(400);
    });

    it("rejects a non-red-card prediction below 1", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.CORNER_KICKS,
          predictedValue: 0,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(400);
    });

    it("rejects duplicate pending risks for the same match category", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ contestId: "c1", riskEnabled: true });
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "m1",
        contestId: "c1",
        kickoffTime: new Date("2025-06-16T12:00:00Z"),
        status: MatchStatus.SCHEDULED,
      });
      mockPrisma.riskPrediction.findUnique.mockResolvedValue({
        id: "r1",
        status: RiskStatus.PENDING,
      });

      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked: 5,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(409);
    });

    it.each([0, -1])("rejects invalid pointsRisked value %s", async (pointsRisked) => {
      const { PUT } = await import("@/app/api/groups/[id]/predictions/risk/route");
      const res = await PUT(
        makeRequest({
          matchId: "m1",
          category: RiskCategory.YELLOW_CARDS,
          predictedValue: 4,
          pointsRisked,
        }),
        { params: Promise.resolve({ id: "g1" }) },
      );

      expect(res.status).toBe(400);
      expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/groups/:id/predictions/risk/:riskId", () => {
    it("cancels a pending risk prediction", async () => {
      mockPrisma.riskPrediction.findUnique.mockResolvedValue({
        id: "r1",
        userId: "u1",
        groupId: "g1",
        status: RiskStatus.PENDING,
        match: {
          kickoffTime: new Date("2025-06-16T12:00:00Z"),
          status: MatchStatus.SCHEDULED,
        },
      });
      mockPrisma.riskPrediction.update.mockResolvedValue({
        id: "r1",
        status: RiskStatus.CANCELLED,
      });
      mockGetAvailableBalance.mockResolvedValue(103);

      const { DELETE } = await import("@/app/api/groups/[id]/predictions/risk/[riskId]/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/risk/r1", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: "g1", riskId: "r1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ success: true, balance: 103 });
      expect(mockPrisma.riskPrediction.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: {
          status: RiskStatus.CANCELLED,
          resolvedAt: expect.any(Date),
          pointsAwarded: null,
        },
      });
      expect(mockGetAvailableBalance).toHaveBeenCalledWith("u1", "g1", mockPrisma);
    });

    it("rejects cancelling a non-pending risk", async () => {
      mockPrisma.riskPrediction.findUnique.mockResolvedValue({
        id: "r1",
        userId: "u1",
        groupId: "g1",
        status: RiskStatus.WON,
        match: {
          kickoffTime: new Date("2025-06-16T12:00:00Z"),
          status: MatchStatus.SCHEDULED,
        },
      });

      const { DELETE } = await import("@/app/api/groups/[id]/predictions/risk/[riskId]/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/risk/r1", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: "g1", riskId: "r1" }) });

      expect(res.status).toBe(400);
    });

    it("rejects cancelling a risk after the match has started", async () => {
      mockPrisma.riskPrediction.findUnique.mockResolvedValue({
        id: "r1",
        userId: "u1",
        groupId: "g1",
        status: RiskStatus.PENDING,
        match: {
          kickoffTime: new Date("2025-06-15T11:00:00Z"),
          status: MatchStatus.IN_PLAY,
        },
      });

      const { DELETE } = await import("@/app/api/groups/[id]/predictions/risk/[riskId]/route");
      const req = new NextRequest("http://localhost/api/groups/g1/predictions/risk/r1", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: "g1", riskId: "r1" }) });

      expect(res.status).toBe(403);
    });
  });
});
