/**
 * Sync service — fetches data from API-Football and upserts into the DB.
 *
 * Usage:
 *   import { syncCompetition } from "@/lib/sync";
 *   await syncCompetition(2);          // sync Champions League (current season)
 *   await syncCompetition(2, 2024);    // sync specific season
 */

import { PrismaClient, ContestStatus, MatchStatus } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FootballApiClient, AfFixture, AfTeamRef, SUPPORTED_COMPETITIONS } from "./football-api";
import { scoreFinishedMatches } from "./scoring-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map API-Football short status code to our MatchStatus enum. */
function toMatchStatus(apiStatus: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    // Scheduled
    TBD: MatchStatus.SCHEDULED,
    NS: MatchStatus.SCHEDULED,
    // In play
    "1H": MatchStatus.IN_PLAY,
    "2H": MatchStatus.IN_PLAY,
    ET: MatchStatus.IN_PLAY,
    P: MatchStatus.IN_PLAY,
    LIVE: MatchStatus.IN_PLAY,
    // Paused
    HT: MatchStatus.PAUSED,
    BT: MatchStatus.PAUSED,
    // Finished
    FT: MatchStatus.FINISHED,
    AET: MatchStatus.FINISHED,
    PEN: MatchStatus.FINISHED,
    // Suspended
    SUSP: MatchStatus.SUSPENDED,
    INT: MatchStatus.SUSPENDED,
    // Postponed
    PST: MatchStatus.POSTPONED,
    // Cancelled
    CANC: MatchStatus.CANCELLED,
    // Awarded
    AWD: MatchStatus.AWARDED,
    WO: MatchStatus.AWARDED,
  };
  return map[apiStatus] ?? MatchStatus.SCHEDULED;
}

/** Derive contest status from season dates. */
function deriveContestStatus(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ContestStatus {
  const now = new Date();
  if (startDate && new Date(startDate) > now) return ContestStatus.UPCOMING;
  if (endDate && new Date(endDate) < now) return ContestStatus.COMPLETED;
  return ContestStatus.ACTIVE;
}

/** Build the season string from the 4-digit year. */
function seasonFromYear(year: number): string {
  return `${year}`;
}

/**
 * Parse matchDay number from API-Football's league.round string.
 * Examples:
 *   "Regular Season - 14" → 14
 *   "League Stage - 8"    → 8
 *   "Round of 16"         → null
 *   "Quarter-finals"      → null
 */
function parseMatchDay(round: string): number | null {
  const match = round.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse the sub-tournament / round-group prefix from the round string.
 * Leagues like Liga MX run two tournaments per season (Apertura, Clausura)
 * and use a "Prefix - N" format in the round field.
 * Examples:
 *   "Apertura - 1"             → "Apertura"
 *   "Clausura - Quarter-finals" → "Clausura"
 *   "Regular Season - 14"      → "Regular Season"
 *   "League Stage - 8"         → "League Stage"
 *   "Round of 16"              → null
 *   "Quarter-finals"           → null
 */
export function parseRoundPrefix(round: string): string | null {
  const sepIdx = round.indexOf(" - ");
  if (sepIdx <= 0) return null;
  return round.substring(0, sepIdx).trim() || null;
}

// ---------------------------------------------------------------------------
// Upsert helpers
// ---------------------------------------------------------------------------

async function upsertTeam(db: PrismaClient, team: AfTeamRef) {
  return db.team.upsert({
    where: { externalId: team.id },
    create: {
      externalId: team.id,
      name: team.name,
      shortName: null,
      tla: null,
      crest: team.logo ?? null,
    },
    update: {
      name: team.name,
      crest: team.logo ?? null,
    },
  });
}

async function upsertMatch(
  db: PrismaClient,
  fixture: AfFixture,
  contestId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  const data = {
    contestId,
    matchDay: parseMatchDay(fixture.league.round),
    stage: fixture.league.round ?? null,
    group: parseRoundPrefix(fixture.league.round),

    homeTeamId,
    awayTeamId,
    kickoffTime: new Date(fixture.fixture.date),
    status: toMatchStatus(fixture.fixture.status.short),
    homeGoals: fixture.goals.home,
    awayGoals: fixture.goals.away,
  };

  return db.match.upsert({
    where: { externalId: fixture.fixture.id },
    create: { externalId: fixture.fixture.id, ...data },
    update: data,
  });
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export interface SyncResult {
  contestId: string;
  teamsUpserted: number;
  matchesUpserted: number;
  predictionsScored: number;
  warning?: string;
}

/**
 * Sync a league from API-Football into the local database.
 *
 * @param leagueId  API-Football league id (e.g. 2 for Champions League)
 * @param season  Optional four-digit year (e.g. 2025). Defaults to current season.
 * @param db  Prisma client instance (dependency injection for testing)
 * @param apiClient  FootballApiClient instance (dependency injection for testing)
 */
export async function syncCompetition(
  leagueId: number,
  season?: number,
  db?: PrismaClient,
  apiClient?: FootballApiClient,
): Promise<SyncResult> {
  const prisma =
    db ??
    (() => {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      return new PrismaClient({ adapter });
    })();
  const api = apiClient ?? new FootballApiClient();

  try {
    // 1. Fetch league info
    const leagueResponse = await api.getLeague(leagueId);
    const entry = leagueResponse.response[0];
    if (!entry) {
      throw new Error(`League with id ${leagueId} not found`);
    }
    const { league, seasons } = entry;
    const currentSeason = seasons.find((s) => s.current) ?? seasons[0];
    if (!currentSeason) {
      throw new Error(`No seasons found for league ${leagueId}`);
    }

    const seasonStr = seasonFromYear(currentSeason.year);
    const code = String(league.id);

    // 2. Upsert the contest
    const contest = await prisma.contest.upsert({
      where: {
        code_season: { code, season: seasonStr },
      },
      create: {
        externalId: league.id,
        name: league.name,
        code,
        season: seasonStr,
        type: league.type,
        emblem: league.logo,
        status: deriveContestStatus(currentSeason.start, currentSeason.end),
        startDate: currentSeason.start ? new Date(currentSeason.start) : null,
        endDate: currentSeason.end ? new Date(currentSeason.end) : null,
      },
      update: {
        name: league.name,
        type: league.type,
        emblem: league.logo,
        status: deriveContestStatus(currentSeason.start, currentSeason.end),
        startDate: currentSeason.start ? new Date(currentSeason.start) : null,
        endDate: currentSeason.end ? new Date(currentSeason.end) : null,
      },
    });

    // 3. Fetch fixtures
    const fixturesResponse = await api.getFixtures(leagueId, season ?? currentSeason.year);
    const fixtures = fixturesResponse.response;

    // Check for API-level errors (e.g. free plan restrictions)
    let warning: string | undefined;
    const apiErrors = fixturesResponse.errors;
    if (apiErrors && typeof apiErrors === "object" && !Array.isArray(apiErrors)) {
      const msgs = Object.values(apiErrors).filter(Boolean);
      if (msgs.length > 0) {
        warning = msgs.join("; ");
      }
    } else if (Array.isArray(apiErrors) && apiErrors.length > 0) {
      warning = apiErrors.join("; ");
    }

    // 4. Filter to most recent sub-tournament when multiple exist
    //    (e.g. Liga MX has Apertura + Clausura in one season — keep only
    //    whichever tournament has the most recent fixture by date)
    let activeFixtures = fixtures;
    if (fixtures.length > 0) {
      const prefixDates = new Map<string, Date>();
      for (const f of fixtures) {
        const prefix = parseRoundPrefix(f.league.round);
        if (prefix) {
          const d = new Date(f.fixture.date);
          const existing = prefixDates.get(prefix);
          if (!existing || d > existing) prefixDates.set(prefix, d);
        }
      }
      if (prefixDates.size > 1) {
        // Multiple sub-tournaments detected — pick the one with the latest fixture
        let latestPrefix = "";
        let latestDate = new Date(0);
        for (const [prefix, date] of prefixDates) {
          if (date > latestDate) {
            latestDate = date;
            latestPrefix = prefix;
          }
        }
        activeFixtures = fixtures.filter((f) => {
          const prefix = parseRoundPrefix(f.league.round);
          return prefix === latestPrefix || prefix === null;
        });
        console.log(
          `  ℹ Multiple sub-tournaments detected (${[...prefixDates.keys()].join(", ")}). ` +
            `Using "${latestPrefix}" (${activeFixtures.length} of ${fixtures.length} fixtures).`,
        );
      }
    }

    // 5. Collect unique teams from the fixture data
    const teamMap = new Map<number, AfTeamRef>();
    for (const f of activeFixtures) {
      if (f.teams.home?.id) teamMap.set(f.teams.home.id, f.teams.home);
      if (f.teams.away?.id) teamMap.set(f.teams.away.id, f.teams.away);
    }

    // 6. Upsert all teams
    const teamIdMap = new Map<number, string>(); // externalId → prisma id
    for (const team of teamMap.values()) {
      const dbTeam = await upsertTeam(prisma, team);
      teamIdMap.set(team.id, dbTeam.id);
    }

    // 7. Upsert all matches
    let matchCount = 0;
    for (const fixture of activeFixtures) {
      const homeTeamId = teamIdMap.get(fixture.teams.home.id);
      const awayTeamId = teamIdMap.get(fixture.teams.away.id);
      if (!homeTeamId || !awayTeamId) continue; // skip fixtures without known teams

      await upsertMatch(prisma, fixture, contest.id, homeTeamId, awayTeamId);
      matchCount++;
    }

    // 8. Score any finished matches that have unscored predictions
    let predictionsScored = 0;
    try {
      const scoringResults = await scoreFinishedMatches(contest.id, prisma);
      predictionsScored = scoringResults.reduce((sum, r) => sum + r.predictionsScored, 0);
      if (predictionsScored > 0) {
        console.log(`  ✓ Scored ${predictionsScored} predictions`);
      }
    } catch (error) {
      console.error("  ✗ Scoring failed:", error);
    }

    return {
      contestId: contest.id,
      teamsUpserted: teamMap.size,
      matchesUpserted: matchCount,
      predictionsScored,
      ...(warning ? { warning } : {}),
    };
  } finally {
    // Only disconnect if we created the client ourselves
    if (!db) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Sync all supported competitions.
 */
export async function syncAll(
  db?: PrismaClient,
  apiClient?: FootballApiClient,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const comp of SUPPORTED_COMPETITIONS) {
    try {
      const result = await syncCompetition(comp.id, undefined, db, apiClient);
      results.push(result);
      console.log(
        `✓ Synced ${comp.name}: ${result.teamsUpserted} teams, ${result.matchesUpserted} matches`,
      );
    } catch (error) {
      console.error(`✗ Failed to sync ${comp.name}:`, error);
    }
  }
  return results;
}
