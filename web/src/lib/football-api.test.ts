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

  it("sends the API key as X-Auth-Token header", async () => {
    const mockResponse = {
      id: 2001,
      name: "UEFA Champions League",
      code: "CL",
      type: "CUP",
      emblem: null,
      currentSeason: {
        id: 1,
        startDate: "2025-09-01",
        endDate: "2026-06-01",
        currentMatchday: 1,
        winner: null,
        stages: ["GROUP_STAGE"],
      },
      seasons: [],
      area: { id: 1, name: "Europe", code: "EUR" },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new FootballApiClient("my-secret-key");
    await client.getCompetition("CL");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.football-data.org/v4/competitions/CL",
      {
        headers: { "X-Auth-Token": "my-secret-key" },
      },
    );
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", { status: 403, statusText: "Forbidden" }),
    );

    const client = new FootballApiClient("bad-key");
    await expect(client.getCompetition("CL")).rejects.toThrow(
      "football-data.org API error: 403",
    );
  });

  it("appends season query param when provided", async () => {
    const mockResponse = {
      filters: {},
      resultSet: { count: 0, first: "", last: "", played: 0 },
      competition: {
        id: 2001,
        name: "CL",
        code: "CL",
        type: "CUP",
        emblem: null,
      },
      matches: [],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const client = new FootballApiClient("key");
    await client.getMatches("CL", 2024);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.football-data.org/v4/competitions/CL/matches?season=2024",
      expect.any(Object),
    );
  });
});

describe("SUPPORTED_COMPETITIONS", () => {
  it("includes Champions League and World Cup", () => {
    const codes = SUPPORTED_COMPETITIONS.map((c) => c.code);
    expect(codes).toContain("CL");
    expect(codes).toContain("WC");
  });
});
