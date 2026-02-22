/**
 * Sync service — fetches data from football-data.org and upserts into the DB.
 *
 * Usage:
 *   import { syncCompetition } from "@/lib/sync";
 *   await syncCompetition("CL");          // sync current season
 *   await syncCompetition("CL", 2024);    // sync specific season
 */

import { PrismaClient, ContestStatus, MatchStatus } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  FootballApiClient,
  FdMatch,
  FdTeamRef,
  CompetitionCode,
  SUPPORTED_COMPETITIONS,
} from "./football-api";
import { scoreFinishedMatches } from "./scoring-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map football-data.org match status string to our MatchStatus enum. */
function toMatchStatus(apiStatus: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    SCHEDULED: MatchStatus.SCHEDULED,
    TIMED: MatchStatus.TIMED,
    IN_PLAY: MatchStatus.IN_PLAY,
    PAUSED: MatchStatus.PAUSED,
    FINISHED: MatchStatus.FINISHED,
    SUSPENDED: MatchStatus.SUSPENDED,
    POSTPONED: MatchStatus.POSTPONED,
    CANCELLED: MatchStatus.CANCELLED,
    AWARDED: MatchStatus.AWARDED,
  };
  return map[apiStatus] ?? MatchStatus.SCHEDULED;
}

/** Derive contest status from match data. */
function deriveContestStatus(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ContestStatus {
  const now = new Date();
  if (startDate && new Date(startDate) > now) return ContestStatus.UPCOMING;
  if (endDate && new Date(endDate) < now) return ContestStatus.COMPLETED;
  return ContestStatus.ACTIVE;
}

/** Build the season string (e.g. "2025" or "2025/2026") from dates. */
function seasonFromDates(startDate: string, endDate: string): string {
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  return startYear === endYear ? `${startYear}` : `${startYear}/${endYear}`;
}

// ---------------------------------------------------------------------------
// Upsert helpers
// ---------------------------------------------------------------------------

async function upsertTeam(db: PrismaClient, team: FdTeamRef) {
  return db.team.upsert({
    where: { externalId: team.id },
    create: {
      externalId: team.id,
      name: team.name,
      shortName: team.shortName ?? null,
      tla: team.tla ?? null,
      crest: team.crest ?? null,
    },
    update: {
      name: team.name,
      shortName: team.shortName ?? null,
      tla: team.tla ?? null,
      crest: team.crest ?? null,
    },
  });
}

async function upsertMatch(
  db: PrismaClient,
  match: FdMatch,
  contestId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  const data = {
    contestId,
    matchDay: match.matchday,
    stage: match.stage ?? null,
    group: match.group ?? null,
    homeTeamId,
    awayTeamId,
    kickoffTime: new Date(match.utcDate),
    status: toMatchStatus(match.status),
    homeGoals: match.score.fullTime.home,
    awayGoals: match.score.fullTime.away,
  };

  return db.match.upsert({
    where: { externalId: match.id },
    create: { externalId: match.id, ...data },
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
}

/**
 * Sync a competition from football-data.org into the local database.
 *
 * @param code  Competition code: "CL" or "WC"
 * @param season  Optional four-digit year (e.g. 2025). Defaults to current season.
 * @param db  Prisma client instance (dependency injection for testing)
 * @param apiClient  FootballApiClient instance (dependency injection for testing)
 */
export async function syncCompetition(
  code: CompetitionCode,
  season?: number,
  db?: PrismaClient,
  apiClient?: FootballApiClient,
): Promise<SyncResult> {
  const prisma = db ?? (() => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    return new PrismaClient({ adapter });
  })();
  const api = apiClient ?? new FootballApiClient();

  try {
    // 1. Fetch competition info
    const competition = await api.getCompetition(code);
    const currentSeason = competition.currentSeason;

    const seasonStr = seasonFromDates(
      currentSeason.startDate,
      currentSeason.endDate,
    );

    // 2. Upsert the contest
    const contest = await prisma.contest.upsert({
      where: {
        code_season: { code: competition.code, season: seasonStr },
      },
      create: {
        externalId: competition.id,
        name: competition.name,
        code: competition.code,
        season: seasonStr,
        type: competition.type,
        emblem: competition.emblem,
        status: deriveContestStatus(
          currentSeason.startDate,
          currentSeason.endDate,
        ),
        startDate: currentSeason.startDate
          ? new Date(currentSeason.startDate)
          : null,
        endDate: currentSeason.endDate
          ? new Date(currentSeason.endDate)
          : null,
      },
      update: {
        name: competition.name,
        type: competition.type,
        emblem: competition.emblem,
        status: deriveContestStatus(
          currentSeason.startDate,
          currentSeason.endDate,
        ),
        startDate: currentSeason.startDate
          ? new Date(currentSeason.startDate)
          : null,
        endDate: currentSeason.endDate
          ? new Date(currentSeason.endDate)
          : null,
      },
    });

    // 3. Fetch matches
    const matchesResponse = await api.getMatches(code, season);
    const matches = matchesResponse.matches;

    // 4. Collect unique teams from the match data
    const teamMap = new Map<number, FdTeamRef>();
    for (const match of matches) {
      if (match.homeTeam?.id) teamMap.set(match.homeTeam.id, match.homeTeam);
      if (match.awayTeam?.id) teamMap.set(match.awayTeam.id, match.awayTeam);
    }

    // 5. Upsert all teams
    const teamIdMap = new Map<number, string>(); // externalId → prisma id
    for (const team of teamMap.values()) {
      const dbTeam = await upsertTeam(prisma, team);
      teamIdMap.set(team.id, dbTeam.id);
    }

    // 6. Upsert all matches
    let matchCount = 0;
    for (const match of matches) {
      const homeTeamId = teamIdMap.get(match.homeTeam.id);
      const awayTeamId = teamIdMap.get(match.awayTeam.id);
      if (!homeTeamId || !awayTeamId) continue; // skip matches without known teams

      await upsertMatch(prisma, match, contest.id, homeTeamId, awayTeamId);
      matchCount++;
    }

    // 7. Score any finished matches that have unscored predictions
    let predictionsScored = 0;
    try {
      const scoringResults = await scoreFinishedMatches(contest.id, prisma);
      predictionsScored = scoringResults.reduce(
        (sum, r) => sum + r.predictionsScored,
        0,
      );
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
      const result = await syncCompetition(
        comp.code,
        undefined,
        db,
        apiClient,
      );
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
