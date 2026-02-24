/**
 * GET /api/admin/competitions
 *
 * Returns the list of leagues available from API-Football,
 * annotated with which ones are already synced locally.
 *
 * Admin only.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { FootballApiClient } from "@/lib/football-api";
import { prisma } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const api = new FootballApiClient();
    const response = await api.listLeagues();

    // Get locally synced contest codes (which are now league id strings)
    const localContests = await prisma.contest.findMany({
      select: { code: true, season: true, name: true, id: true, status: true },
    });
    const syncedCodes = new Set(localContests.map((c) => c.code));

    const competitions = response.response.map((entry) => {
      const currentSeason = entry.seasons.find((s) => s.current) ?? entry.seasons[0] ?? null;
      return {
        id: entry.league.id,
        name: entry.league.name,
        leagueId: entry.league.id,
        type: entry.league.type,
        emblem: entry.league.logo,
        area: entry.country.name,
        areaFlag: entry.country.flag ?? null,
        currentSeason: currentSeason
          ? {
              startDate: currentSeason.start ?? null,
              endDate: currentSeason.end ?? null,
            }
          : null,
        numberOfAvailableSeasons: entry.seasons.length,
        synced: syncedCodes.has(String(entry.league.id)),
      };
    });

    return NextResponse.json({
      competitions,
      localContests,
    });
  } catch (err) {
    console.error("Failed to fetch leagues:", err);
    return NextResponse.json(
      { error: "Failed to fetch leagues from API-Football" },
      { status: 502 },
    );
  }
}
