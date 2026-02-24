/**
 * POST /api/admin/sync
 *
 * Triggers a sync for a specific league by numeric id.
 * Body: { leagueId: number }
 *
 * Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { syncCompetition } from "@/lib/sync";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { leagueId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leagueId = body.leagueId;
  if (!leagueId || typeof leagueId !== "number") {
    return NextResponse.json(
      { error: "Missing required field: leagueId (number)" },
      { status: 400 },
    );
  }

  try {
    const result = await syncCompetition(leagueId, undefined, prisma);
    return NextResponse.json({
      success: true,
      result: {
        contestId: result.contestId,
        teamsUpserted: result.teamsUpserted,
        matchesUpserted: result.matchesUpserted,
        predictionsScored: result.predictionsScored,
        warning: result.warning ?? null,
      },
    });
  } catch (err) {
    console.error(`Sync failed for league ${leagueId}:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Sync failed: ${message}` },
      { status: 500 },
    );
  }
}
