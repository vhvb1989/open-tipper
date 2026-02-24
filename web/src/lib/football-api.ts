/**
 * API-Football v3 client.
 *
 * Docs: https://www.api-football.com/documentation-v3
 * Free tier: 100 requests/day.
 *
 * Supported competitions:
 *   - UEFA Champions League — id 2
 *   - FIFA World Cup        — id 1
 *   - Liga MX               — id 262
 */

const BASE_URL = "https://v3.football.api-sports.io";

// ---------------------------------------------------------------------------
// Types — mirrors the relevant parts of the API-Football v3 response
// ---------------------------------------------------------------------------

/** Wrapper around every API-Football response. */
export interface AfApiResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

// -- Leagues / Competitions --

export interface AfCountry {
  name: string;
  code: string | null;
  flag: string | null;
}

export interface AfLeague {
  id: number;
  name: string;
  type: string; // "League" | "Cup"
  logo: string | null;
}

export interface AfSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: Record<string, unknown>;
}

export interface AfLeagueEntry {
  league: AfLeague;
  country: AfCountry;
  seasons: AfSeason[];
}

// -- Fixtures / Matches --

export interface AfFixtureInfo {
  id: number;
  date: string;
  status: { short: string; long: string; elapsed: number | null };
}

export interface AfFixtureLeague {
  id: number;
  name: string;
  round: string;
}

export interface AfTeamRef {
  id: number;
  name: string;
  logo: string | null;
}

export interface AfGoals {
  home: number | null;
  away: number | null;
}

export interface AfFixture {
  fixture: AfFixtureInfo;
  league: AfFixtureLeague;
  teams: { home: AfTeamRef; away: AfTeamRef };
  goals: AfGoals;
  score: {
    halftime: AfGoals;
    fulltime: AfGoals;
    extratime: AfGoals;
    penalty: AfGoals;
  };
}

// ---------------------------------------------------------------------------
// Competitions we support
// ---------------------------------------------------------------------------

export const SUPPORTED_COMPETITIONS = [
  { id: 2, name: "UEFA Champions League" },
  { id: 1, name: "FIFA World Cup" },
  { id: 262, name: "Liga MX" },
] as const;

export type SupportedLeagueId = (typeof SUPPORTED_COMPETITIONS)[number]["id"];

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class FootballApiClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.FOOTBALL_API_KEY;
    if (!key) {
      throw new Error(
        "FOOTBALL_API_KEY is required. Get one at https://dashboard.api-football.com/",
      );
    }
    this.apiKey = key;
  }

  private async request<T>(path: string): Promise<AfApiResponse<T>> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": this.apiKey,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `API-Football error: ${res.status} ${res.statusText} — ${url}\n${body}`,
      );
    }

    return res.json() as Promise<AfApiResponse<T>>;
  }

  /**
   * List all available leagues from the API.
   */
  async listLeagues(): Promise<AfApiResponse<AfLeagueEntry>> {
    return this.request<AfLeagueEntry>("/leagues");
  }

  /**
   * Fetch details for a single league by numeric id.
   */
  async getLeague(leagueId: number): Promise<AfApiResponse<AfLeagueEntry>> {
    return this.request<AfLeagueEntry>(`/leagues?id=${leagueId}`);
  }

  /**
   * Fetch all fixtures for a league in a given season.
   * If no season is provided, the API returns the current season's fixtures.
   */
  async getFixtures(
    leagueId: number,
    season?: number,
  ): Promise<AfApiResponse<AfFixture>> {
    const params = [`league=${leagueId}`];
    if (season) params.push(`season=${season}`);
    return this.request<AfFixture>(`/fixtures?${params.join("&")}`);
  }
}
