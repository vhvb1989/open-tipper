/**
 * football-data.org API v4 client.
 *
 * Docs: https://docs.football-data.org/general/v4/index.html
 * Free tier: 10 requests/minute.
 *
 * Supported competitions:
 *   - CL (Champions League) — id 2001
 *   - WC (World Cup)        — id 2000
 */

const BASE_URL = "https://api.football-data.org/v4";

// ---------------------------------------------------------------------------
// Types — mirrors the relevant parts of the football-data.org v4 response
// ---------------------------------------------------------------------------

export interface FdArea {
  id: number;
  name: string;
  code: string;
  flag?: string;
}

export interface FdSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
  winner: FdTeamRef | null;
  stages: string[];
}

export interface FdCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  currentSeason: FdSeason;
  seasons?: FdSeason[];
}

export interface FdTeamRef {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

export interface FdScore {
  winner: string | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: FdTeamRef;
  awayTeam: FdTeamRef;
  score: FdScore;
}

export interface FdCompetitionResponse {
  area: FdArea;
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  currentSeason: FdSeason;
  seasons: FdSeason[];
}

export interface FdMatchesResponse {
  filters: Record<string, string>;
  resultSet: {
    count: number;
    first: string;
    last: string;
    played: number;
  };
  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string | null;
  };
  matches: FdMatch[];
}

// ---------------------------------------------------------------------------
// Competition codes we support
// ---------------------------------------------------------------------------

export const SUPPORTED_COMPETITIONS = [
  { code: "CL", id: 2001, name: "UEFA Champions League" },
  { code: "WC", id: 2000, name: "FIFA World Cup" },
] as const;

export type CompetitionCode = (typeof SUPPORTED_COMPETITIONS)[number]["code"];

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class FootballApiClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.FOOTBALL_API_KEY;
    if (!key) {
      throw new Error(
        "FOOTBALL_API_KEY is required. Get one at https://www.football-data.org/",
      );
    }
    this.apiKey = key;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        "X-Auth-Token": this.apiKey,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `football-data.org API error: ${res.status} ${res.statusText} — ${url}\n${body}`,
      );
    }

    return res.json() as Promise<T>;
  }

  /**
   * Fetch details for a single competition (including season information).
   */
  async getCompetition(code: CompetitionCode): Promise<FdCompetitionResponse> {
    return this.request<FdCompetitionResponse>(`/competitions/${code}`);
  }

  /**
   * Fetch all matches for a competition in a given season.
   * If no season is provided, defaults to the current season.
   */
  async getMatches(
    code: CompetitionCode,
    season?: number,
  ): Promise<FdMatchesResponse> {
    const query = season ? `?season=${season}` : "";
    return this.request<FdMatchesResponse>(
      `/competitions/${code}/matches${query}`,
    );
  }
}
