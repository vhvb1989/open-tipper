/**
 * GET /api/cron/sync-live
 *
 * Background polling endpoint — syncs all contests that have live or
 * upcoming matches. Protected by a CRON_SECRET bearer token so it can
 * be called from Azure Functions timer trigger or a local polling script
 * without requiring an admin session.
 *
 * Returns a summary of what was synced.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncCompetition } from "@/lib/sync";

/**
 * Verify the request carries the correct CRON_SECRET.
 * In development mode, the secret check is skipped when CRON_SECRET is not set.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // In development, allow unauthenticated calls when no secret is configured
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find contests that have matches that are live, paused, or kicking off soon
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000);

    const contestsWithActiveMatches = await prisma.contest.findMany({
      where: {
        OR: [
          // Contests with live/paused matches
          {
            matches: {
              some: {
                status: { in: ["IN_PLAY", "PAUSED"] },
              },
            },
          },
          // Contests with matches kicking off in the next 30 minutes
          {
            matches: {
              some: {
                status: "SCHEDULED",
                kickoffTime: { lte: thirtyMinutesFromNow },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        code: true,
      },
    });

    if (contestsWithActiveMatches.length === 0) {
      return NextResponse.json({
        message: "No active matches to sync",
        synced: [],
      });
    }

    const results = [];
    for (const contest of contestsWithActiveMatches) {
      if (contest.externalId === null) continue;
      try {
        const result = await syncCompetition(contest.externalId, undefined, prisma);
        results.push({
          contestId: contest.id,
          contestName: contest.name,
          teamsUpserted: result.teamsUpserted,
          matchesUpserted: result.matchesUpserted,
          predictionsScored: result.predictionsScored,
          warning: result.warning ?? null,
        });
        console.log(
          `[cron] Synced ${contest.name}: ${result.matchesUpserted} matches, ${result.predictionsScored} scored`,
        );
      } catch (err) {
        console.error(`[cron] Failed to sync ${contest.name}:`, err);
        results.push({
          contestId: contest.id,
          contestName: contest.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Synced ${results.length} contest(s)`,
      synced: results,
    });
  } catch (error) {
    console.error("[cron] sync-live failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
