import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma
const mockPrisma = {
  match: {
    findMany: vi.fn(),
  },
  prediction: {
    count: vi.fn(),
  },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/live/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an SSE stream response with correct headers", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    mockPrisma.prediction.count.mockResolvedValue(0);

    const { GET } = await import("./route");
    const controller = new AbortController();
    const req = new Request("http://localhost:3000/api/live/stream?contestIds=c1,c2", {
      signal: controller.signal,
    });

    const res = await GET(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");

    // Clean up
    controller.abort();
  });

  it("sends initial heartbeat", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    mockPrisma.prediction.count.mockResolvedValue(0);

    const { GET } = await import("./route");
    const controller = new AbortController();
    const req = new Request("http://localhost:3000/api/live/stream", {
      signal: controller.signal,
    });

    const res = await GET(req as unknown as import("next/server").NextRequest);
    const reader = res.body!.getReader();

    // Read the initial chunk (heartbeat)
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain(": heartbeat");

    controller.abort();
  });

  it("sends match-update events when matches change", async () => {
    const liveMatch = {
      id: "m1",
      externalId: 123,
      status: "IN_PLAY",
      homeGoals: 1,
      awayGoals: 0,
      kickoffTime: new Date("2026-02-24T20:00:00Z"),
      matchDay: 5,
      stage: "Regular Season - 5",
      updatedAt: new Date(),
      homeTeam: { id: "t1", name: "Team A", shortName: null, crest: null },
      awayTeam: { id: "t2", name: "Team B", shortName: null, crest: null },
      contestId: "c1",
    };

    mockPrisma.match.findMany.mockResolvedValue([liveMatch]);
    mockPrisma.prediction.count.mockResolvedValue(0);

    const { GET } = await import("./route");
    const controller = new AbortController();
    const req = new Request("http://localhost:3000/api/live/stream?contestIds=c1", {
      signal: controller.signal,
    });

    const res = await GET(req as unknown as import("next/server").NextRequest);
    const reader = res.body!.getReader();

    // Read initial heartbeat
    await reader.read();

    // Advance timer to trigger first poll
    await vi.advanceTimersByTimeAsync(10_000);

    // Read the match-update event
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: match-update");
    expect(text).toContain('"status":"IN_PLAY"');
    expect(text).toContain('"homeGoals":1');

    controller.abort();
  });
});
