import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma
const mockPrisma = {
  contest: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

// Mock sync
const mockSyncCompetition = vi.fn();
vi.mock("@/lib/sync", () => ({
  syncCompetition: (...args: unknown[]) => mockSyncCompetition(...args),
}));

describe("GET /api/cron/sync-live", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no CRON_SECRET set (dev mode) and NODE_ENV is test
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when CRON_SECRET is set and wrong token is provided", async () => {
    process.env.CRON_SECRET = "my-secret";
    process.env.NODE_ENV = "production";
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/cron/sync-live", {
      headers: { authorization: "Bearer wrong-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    delete process.env.NODE_ENV;
  });

  it("returns success when no active matches", async () => {
    mockPrisma.contest.findMany.mockResolvedValue([]);
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/cron/sync-live");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("No active matches to sync");
    expect(data.synced).toEqual([]);
  });

  it("syncs contests with active matches", async () => {
    mockPrisma.contest.findMany.mockResolvedValue([
      { id: "c1", externalId: 2, name: "Champions League", code: "2" },
    ]);
    mockSyncCompetition.mockResolvedValue({
      contestId: "c1",
      teamsUpserted: 4,
      matchesUpserted: 2,
      predictionsScored: 5,
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/cron/sync-live");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("Synced 1 contest(s)");
    expect(data.synced).toHaveLength(1);
    expect(data.synced[0].matchesUpserted).toBe(2);
    expect(data.synced[0].predictionsScored).toBe(5);
    expect(mockSyncCompetition).toHaveBeenCalledWith(2, undefined, mockPrisma);
  });

  it("handles sync errors gracefully", async () => {
    mockPrisma.contest.findMany.mockResolvedValue([
      { id: "c1", externalId: 2, name: "Champions League", code: "2" },
    ]);
    mockSyncCompetition.mockRejectedValue(new Error("API limit reached"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/cron/sync-live");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.synced[0].error).toBe("API limit reached");
  });

  it("skips contests without externalId", async () => {
    mockPrisma.contest.findMany.mockResolvedValue([
      { id: "c1", externalId: null, name: "Manual Contest", code: "manual" },
    ]);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/cron/sync-live");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.synced).toEqual([]);
    expect(mockSyncCompetition).not.toHaveBeenCalled();
  });

  it("allows access with correct CRON_SECRET", async () => {
    process.env.CRON_SECRET = "my-secret";
    mockPrisma.contest.findMany.mockResolvedValue([]);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/cron/sync-live", {
      headers: { authorization: "Bearer my-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
