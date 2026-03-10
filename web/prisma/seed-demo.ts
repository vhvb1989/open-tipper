/**
 * Demo seed script — creates realistic test data for local development.
 *
 * Creates:
 *   - 18 Liga MX Clausura 2026 teams with real crests
 *   - 17 match days (153 matches total), some FINISHED with scores, some SCHEDULED
 *   - 8 demo user accounts
 *   - 1 public group "Liga MX Fans" (with scoring rules)
 *   - Predictions for every finished match + some upcoming matches
 *   - Points scored via the scoring engine for finished matches
 *
 * Usage:
 *   npx tsx prisma/seed-demo.ts          # seeds fresh demo data
 *   npx tsx prisma/seed-demo.ts --clean  # wipe everything first
 *
 * Requires:
 *   - DATABASE_URL set
 *   - Database migrated (npx prisma migrate dev)
 *   - Does NOT require FOOTBALL_API_KEY
 */

import "dotenv/config";
import { PrismaClient, MatchStatus, ContestStatus } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { calculateScore, DEFAULT_SCORING_RULES } from "../src/lib/scoring";
import { awardMedalsForContest } from "../src/lib/medals";

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------

function createPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

// ---------------------------------------------------------------------------
// Liga MX Clausura 2026 — Teams
// ---------------------------------------------------------------------------

interface DemoTeam {
  externalId: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

const LIGA_MX_TEAMS: DemoTeam[] = [
  {
    externalId: 902283,
    name: "Club América",
    shortName: "América",
    tla: "AME",
    crest: "https://media.api-sports.io/football/teams/2283.png",
  },
  {
    externalId: 902282,
    name: "Guadalajara (Chivas)",
    shortName: "Chivas",
    tla: "CHI",
    crest: "https://media.api-sports.io/football/teams/2282.png",
  },
  {
    externalId: 902284,
    name: "Cruz Azul",
    shortName: "Cruz Azul",
    tla: "CRA",
    crest: "https://media.api-sports.io/football/teams/2284.png",
  },
  {
    externalId: 902286,
    name: "UNAM Pumas",
    shortName: "Pumas",
    tla: "PUM",
    crest: "https://media.api-sports.io/football/teams/2286.png",
  },
  {
    externalId: 902288,
    name: "Tigres UANL",
    shortName: "Tigres",
    tla: "TIG",
    crest: "https://media.api-sports.io/football/teams/2288.png",
  },
  {
    externalId: 902287,
    name: "Monterrey",
    shortName: "Monterrey",
    tla: "MTY",
    crest: "https://media.api-sports.io/football/teams/2287.png",
  },
  {
    externalId: 902290,
    name: "Santos Laguna",
    shortName: "Santos",
    tla: "SAN",
    crest: "https://media.api-sports.io/football/teams/2290.png",
  },
  {
    externalId: 902285,
    name: "Toluca",
    shortName: "Toluca",
    tla: "TOL",
    crest: "https://media.api-sports.io/football/teams/2285.png",
  },
  {
    externalId: 902291,
    name: "León",
    shortName: "León",
    tla: "LEO",
    crest: "https://media.api-sports.io/football/teams/2291.png",
  },
  {
    externalId: 902289,
    name: "Atlas",
    shortName: "Atlas",
    tla: "ATL",
    crest: "https://media.api-sports.io/football/teams/2289.png",
  },
  {
    externalId: 902292,
    name: "Pachuca",
    shortName: "Pachuca",
    tla: "PAC",
    crest: "https://media.api-sports.io/football/teams/2292.png",
  },
  {
    externalId: 902293,
    name: "Puebla",
    shortName: "Puebla",
    tla: "PUE",
    crest: "https://media.api-sports.io/football/teams/2293.png",
  },
  {
    externalId: 902294,
    name: "Necaxa",
    shortName: "Necaxa",
    tla: "NEC",
    crest: "https://media.api-sports.io/football/teams/2294.png",
  },
  {
    externalId: 902296,
    name: "Querétaro",
    shortName: "Querétaro",
    tla: "QRO",
    crest: "https://media.api-sports.io/football/teams/2296.png",
  },
  {
    externalId: 902297,
    name: "Tijuana",
    shortName: "Tijuana",
    tla: "TIJ",
    crest: "https://media.api-sports.io/football/teams/2297.png",
  },
  {
    externalId: 902298,
    name: "Mazatlán FC",
    shortName: "Mazatlán",
    tla: "MAZ",
    crest: "https://media.api-sports.io/football/teams/2298.png",
  },
  {
    externalId: 902299,
    name: "FC Juárez",
    shortName: "Juárez",
    tla: "JUA",
    crest: "https://media.api-sports.io/football/teams/2299.png",
  },
  {
    externalId: 902295,
    name: "San Luis",
    shortName: "San Luis",
    tla: "SLU",
    crest: "https://media.api-sports.io/football/teams/2295.png",
  },
];

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------

interface DemoUser {
  name: string;
  email: string;
  image: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    name: "Carlos García",
    email: "carlos@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Carlos",
  },
  {
    name: "María López",
    email: "maria@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Maria",
  },
  {
    name: "Juan Hernández",
    email: "juan@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Juan",
  },
  {
    name: "Ana Martínez",
    email: "ana@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Ana",
  },
  {
    name: "Pedro Rodríguez",
    email: "pedro@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Pedro",
  },
  {
    name: "Sofía Ramírez",
    email: "sofia@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sofia",
  },
  {
    name: "Diego Torres",
    email: "diego@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Diego",
  },
  {
    name: "Lucía Flores",
    email: "lucia@demo.local",
    image: "https://api.dicebear.com/9.x/avataaars/svg?seed=Lucia",
  },
];

// ---------------------------------------------------------------------------
// Seeded RNG (deterministic results)
// ---------------------------------------------------------------------------

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  /** Returns a float in [0, 1) */
  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  /** Returns int in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** Returns true with given probability */
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

// ---------------------------------------------------------------------------
// Round-robin schedule generator
// ---------------------------------------------------------------------------

/**
 * Generate a full round-robin schedule (each team plays every other team once).
 * Returns an array of match days, each containing an array of [homeIdx, awayIdx].
 */
function generateRoundRobin(teamCount: number): [number, number][][] {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1; // pad if odd
  const teams = Array.from({ length: n }, (_, i) => i);
  const rounds: [number, number][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const matches: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      // Skip if one is the padding "ghost" team
      if (home < teamCount && away < teamCount) {
        matches.push(round % 2 === 0 ? [home, away] : [away, home]);
      }
    }
    rounds.push(matches);
    // Rotate all except the first team
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return rounds;
}

// ---------------------------------------------------------------------------
// Score generators
// ---------------------------------------------------------------------------

function generateMatchScore(rng: SeededRandom): [number, number] {
  // Weighted towards realistic Liga MX scores
  const weights = [
    { score: [1, 0], w: 12 },
    { score: [0, 1], w: 12 },
    { score: [2, 1], w: 14 },
    { score: [1, 2], w: 14 },
    { score: [1, 1], w: 13 },
    { score: [0, 0], w: 7 },
    { score: [2, 0], w: 8 },
    { score: [0, 2], w: 8 },
    { score: [2, 2], w: 5 },
    { score: [3, 1], w: 5 },
    { score: [1, 3], w: 5 },
    { score: [3, 0], w: 3 },
    { score: [0, 3], w: 3 },
    { score: [3, 2], w: 3 },
    { score: [2, 3], w: 3 },
    { score: [4, 1], w: 1 },
    { score: [1, 4], w: 1 },
    { score: [4, 0], w: 1 },
    { score: [3, 3], w: 1 },
  ];
  const totalW = weights.reduce((s, w) => s + w.w, 0);
  let r = rng.next() * totalW;
  for (const { score, w } of weights) {
    r -= w;
    if (r <= 0) return score as [number, number];
  }
  return [1, 1];
}

function generatePrediction(rng: SeededRandom, actual: [number, number]): [number, number] {
  const r = rng.next();
  // 10% chance of exact match
  if (r < 0.1) return [actual[0], actual[1]];
  // 20% chance of close prediction (±1 on one side)
  if (r < 0.3) {
    const side = rng.int(0, 1);
    const delta = rng.pick([-1, 1]);
    const pred: [number, number] = [...actual];
    pred[side] = Math.max(0, pred[side] + delta);
    return pred;
  }
  // 70% random realistic score
  return generateMatchScore(rng);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cleanFlag = process.argv.includes("--clean");

  if (cleanFlag) {
    console.log("🗑️  Cleaning database...");
    // Delete in dependency order
    await prisma.prediction.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.scoringRules.deleteMany();
    await prisma.group.deleteMany();
    await prisma.match.deleteMany();
    await prisma.contest.deleteMany();
    await prisma.team.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    console.log("   Done.\n");
  }

  const rng = new SeededRandom(42);

  // -----------------------------------------------------------------------
  // 1. Contest
  // -----------------------------------------------------------------------
  console.log("⚽ Creating Liga MX Clausura 2026 contest...");
  const contest = await prisma.contest.upsert({
    where: { code_season: { code: "262-demo", season: "2026" } },
    create: {
      externalId: 999262, // Fake ID to avoid conflict with real API-Football data
      name: "Liga MX — Clausura 2026",
      code: "262-demo",
      season: "2026",
      type: "LEAGUE",
      emblem: "https://media.api-sports.io/football/leagues/262.png",
      status: ContestStatus.ACTIVE,
      startDate: new Date("2026-01-10"),
      endDate: new Date("2026-05-31"),
    },
    update: {},
  });

  // -----------------------------------------------------------------------
  // 2. Teams
  // -----------------------------------------------------------------------
  console.log("🏟️  Creating 18 Liga MX teams...");
  const teamIds: string[] = [];
  for (const t of LIGA_MX_TEAMS) {
    const team = await prisma.team.upsert({
      where: { externalId: t.externalId },
      create: {
        externalId: t.externalId,
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crest: t.crest,
      },
      update: {
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crest: t.crest,
      },
    });
    teamIds.push(team.id);
  }

  // -----------------------------------------------------------------------
  // 3. Matches (round-robin, 17 match days)
  // -----------------------------------------------------------------------
  console.log("📅 Generating 17 match days...");
  const schedule = generateRoundRobin(LIGA_MX_TEAMS.length);
  const now = new Date("2026-03-10T12:00:00Z"); // "today" for the demo
  const seasonStart = new Date("2026-01-10T00:00:00Z");

  // We'll produce exactly as many rounds as the round-robin gives (17 for 18 teams)
  let fixtureExternalId = 900000; // starting fake external ID
  const allMatchIds: {
    matchId: string;
    matchDay: number;
    homeGoals: number | null;
    awayGoals: number | null;
  }[] = [];

  for (let day = 0; day < schedule.length; day++) {
    const matchDay = day + 1;
    const round = schedule[day];

    // Space match days ~4 days apart, first one at seasonStart
    const dayDate = new Date(seasonStart.getTime() + day * 4 * 24 * 60 * 60 * 1000);
    const isFinished = dayDate < now;
    // Make matchday 8 "in play" for demo live badge
    const isLive = matchDay === 8 && dayDate <= now;

    for (let g = 0; g < round.length; g++) {
      const [hi, ai] = round[g];
      // Stagger games within the day: 12:00, 14:00, 16:00, ...
      const kickoff = new Date(dayDate);
      kickoff.setUTCHours(12 + g * 2, 0, 0, 0);

      let status: MatchStatus;
      let homeGoals: number | null = null;
      let awayGoals: number | null = null;

      if (isLive && g < 2) {
        // First 2 games of matchday 8 are "in play"
        status = MatchStatus.IN_PLAY;
        homeGoals = rng.int(0, 2);
        awayGoals = rng.int(0, 2);
      } else if (isFinished) {
        status = MatchStatus.FINISHED;
        [homeGoals, awayGoals] = generateMatchScore(rng);
      } else {
        status = MatchStatus.SCHEDULED;
      }

      fixtureExternalId++;

      const match = await prisma.match.upsert({
        where: { externalId: fixtureExternalId },
        create: {
          externalId: fixtureExternalId,
          contestId: contest.id,
          matchDay,
          stage: `Clausura - ${matchDay}`,
          group: "Clausura",
          homeTeamId: teamIds[hi],
          awayTeamId: teamIds[ai],
          kickoffTime: kickoff,
          status,
          homeGoals,
          awayGoals,
        },
        update: {},
      });

      allMatchIds.push({ matchId: match.id, matchDay, homeGoals, awayGoals });
    }
  }

  const finishedMatches = allMatchIds.filter((m) => m.homeGoals !== null);
  const scheduledMatches = allMatchIds.filter((m) => m.homeGoals === null);
  console.log(
    `   ${allMatchIds.length} matches: ${finishedMatches.length} finished, ${scheduledMatches.length} scheduled`,
  );

  // -----------------------------------------------------------------------
  // 4. Users
  // -----------------------------------------------------------------------
  console.log("👥 Creating 8 demo users...");
  const userIds: string[] = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        image: u.image,
        role: u.email === "carlos@demo.local" ? "ADMIN" : "USER",
        emailVerified: new Date(),
      },
      update: {
        name: u.name,
        image: u.image,
      },
    });
    userIds.push(user.id);
  }

  // -----------------------------------------------------------------------
  // 5. Public group + scoring rules
  // -----------------------------------------------------------------------
  console.log("🏆 Creating public group 'Liga MX Fans'...");
  const group = await prisma.group.upsert({
    where: { inviteCode: "demo-liga-mx-2026" },
    create: {
      name: "Liga MX Fans",
      description:
        "Grupo público de demostración para la Liga MX Clausura 2026. ¡Haz tus predicciones y compite con tus amigos!",
      visibility: "PUBLIC",
      inviteCode: "demo-liga-mx-2026",
      contestId: contest.id,
    },
    update: {},
  });

  // Scoring rules (default values)
  await prisma.scoringRules.upsert({
    where: { groupId: group.id },
    create: {
      groupId: group.id,
      exactScore: 10,
      goalDifference: 6,
      outcome: 4,
      oneTeamGoals: 3,
      totalGoals: 2,
      reverseGoalDifference: 1,
      accumulationMode: "ACCUMULATE",
      playoffMultiplier: false,
    },
    update: {},
  });

  // -----------------------------------------------------------------------
  // 6. Memberships — all users join the group
  // -----------------------------------------------------------------------
  console.log("🤝 Adding all users to the group...");
  for (let i = 0; i < userIds.length; i++) {
    await prisma.membership.upsert({
      where: { userId_groupId: { userId: userIds[i], groupId: group.id } },
      create: {
        userId: userIds[i],
        groupId: group.id,
        role: i === 0 ? "ADMIN" : "MEMBER",
      },
      update: {},
    });
  }

  // -----------------------------------------------------------------------
  // 7. Predictions for finished matches
  // -----------------------------------------------------------------------
  console.log("🔮 Generating predictions for finished matches...");
  let predCount = 0;

  for (const fm of finishedMatches) {
    for (const userId of userIds) {
      // Each user has a 90% chance of having predicted any given finished match
      if (!rng.chance(0.9)) continue;

      const [predHome, predAway] = generatePrediction(rng, [fm.homeGoals!, fm.awayGoals!]);
      const breakdown = calculateScore(
        { homeGoals: predHome, awayGoals: predAway },
        { homeGoals: fm.homeGoals!, awayGoals: fm.awayGoals! },
        DEFAULT_SCORING_RULES,
      );

      await prisma.prediction.upsert({
        where: {
          userId_groupId_matchId: {
            userId,
            groupId: group.id,
            matchId: fm.matchId,
          },
        },
        create: {
          userId,
          groupId: group.id,
          matchId: fm.matchId,
          homeGoals: predHome,
          awayGoals: predAway,
          pointsAwarded: breakdown.total,
        },
        update: {},
      });
      predCount++;
    }
  }

  // -----------------------------------------------------------------------
  // 8. Predictions for some upcoming matches (to show pending predictions)
  // -----------------------------------------------------------------------
  console.log("📝 Generating predictions for some upcoming matches...");
  let upcomingPredCount = 0;

  // Only predict on the next 2 match days of scheduled matches
  const nextMatchDays = Array.from(new Set(scheduledMatches.map((m) => m.matchDay)))
    .sort((a, b) => a - b)
    .slice(0, 2);

  for (const sm of scheduledMatches.filter((m) => nextMatchDays.includes(m.matchDay))) {
    for (const userId of userIds) {
      // 60% chance a user has already predicted upcoming matches
      if (!rng.chance(0.6)) continue;

      const [predHome, predAway] = generateMatchScore(rng);
      await prisma.prediction.upsert({
        where: {
          userId_groupId_matchId: {
            userId,
            groupId: group.id,
            matchId: sm.matchId,
          },
        },
        create: {
          userId,
          groupId: group.id,
          matchId: sm.matchId,
          homeGoals: predHome,
          awayGoals: predAway,
          pointsAwarded: null, // not scored yet
        },
        update: {},
      });
      upcomingPredCount++;
    }
  }

  // -----------------------------------------------------------------------
  // 9. Award match-day medals
  // -----------------------------------------------------------------------
  console.log("🏅 Awarding match-day medals...");
  const medalResults = await awardMedalsForContest(contest.id, prisma);
  const totalMedals = medalResults.reduce((sum, r) => sum + r.winnersCount, 0);
  console.log(`   ${totalMedals} medals awarded across ${medalResults.length} match days`);

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log("\n📊 Demo seed summary:");
  console.log(`   Contest:     ${contest.name}`);
  console.log(`   Teams:       ${LIGA_MX_TEAMS.length}`);
  console.log(
    `   Matches:     ${allMatchIds.length} (${finishedMatches.length} finished, ${scheduledMatches.length} scheduled)`,
  );
  console.log(`   Users:       ${DEMO_USERS.length}`);
  console.log(`   Group:       ${group.name} (${group.visibility}, invite: ${group.inviteCode})`);
  console.log(`   Predictions: ${predCount} scored + ${upcomingPredCount} pending`);
  console.log("\n✅ Demo seed complete!");
  console.log("\n💡 Tip: Sign in with any OAuth provider. Then visit:");
  console.log(`   /groups → join "${group.name}" using invite code: demo-liga-mx-2026`);
  console.log("   Or browse public groups to find it.\n");
}

main()
  .catch((err) => {
    console.error("❌ Demo seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
