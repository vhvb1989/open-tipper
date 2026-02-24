import { describe, it, expect, vi, beforeEach } from "vitest";
import { FootballApiClient, SUPPORTED_COMPETITIONS } from "./football-api";

describe("FootballApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if no API key is provided", () => {
    const original = process.env.FOOTBALL_API_KEY;
    delete process.env.FOOTBALL_API_KEY;
    try {
      expect(() => new FootballApiClient()).toThrow("FOOTBALL_API_KEY");
    } finally {
      if (original) process.env.FOOTBALL_API_KEY = original;
    }
  });

  it("constructs with an explicit API key", () => {
    const client = new FootballApiClient("test-key");
    expect(client).toBeDefined();
  });

  it("sends the API key as x-apisports-key header", async () => {
    const mockResponse = {
      get: "leagues",
      parameters: { id: "2" },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [
        {
          league: { id: 2, name: "UEFA Champions League", type: "Cup", logo: null },
          country: { name: "World", code: null, flag: null },
          seasons: [
            { year: 2024, start: "2024-09-01", end: "2025-06-01", current: true, coverage: {} },
          ],
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new FootballApiClient("my-secret-key");
    await client.getLeague(2);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://v3.football.api-sports.io/leagues?id=2",
      {
        headers: { "x-apisports-key": "my-secret-key" },
      },
    );
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", { status: 403, statusText: "Forbidden" }),
    );

    const client = new FootballApiClient("bad-key");
    await expect(client.getLeague(2)).rejects.toThrow(
      "API-Football error: 403",
    );
  });

  it("appends season query param when provided", async () => {
    const mockResponse = {
      get: "fixtures",
      parameters: { league: "2", season: "2024" },
      errors: [],
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const client = new FootballApiClient("key");
    await client.getFixtures(2, 2024);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://v3.football.api-sports.io/fixtures?league=2&season=2024",
      expect.any(Object),
    );
  });
});

describe("SUPPORTED_COMPETITIONS", () => {
  it("includes Champions League, World Cup, and Liga MX", () => {
    const ids = SUPPORTED_COMPETITIONS.map((c) => c.id);
    expect(ids).toContain(2); // Champions League
    expect(ids).toContain(1); // World Cup
    expect(ids).toContain(262); // Liga MX
  });
});
