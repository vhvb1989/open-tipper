import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/:id/predictions/sync
 *
 * Sync predictions from the current group to all other groups the user
 * belongs to for the same contest. Only syncs predictions for matches
 * that have not yet kicked off.
 *
 * Body: { matchId?: string }
 *   - If matchId is provided, only sync that single match prediction.
 *   - If omitted, sync all predictions from this group.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sourceGroupId } = await params;
    const body = await request.json();
    const { matchId } = body;

    // Get the source group's contest
    const sourceGroup = await prisma.group.findUnique({
      where: { id: sourceGroupId },
      select: { id: true, contestId: true },
    });
    if (!sourceGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Verify membership in source group
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: { userId: session.user.id, groupId: sourceGroupId },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Find all other groups the user belongs to for the same contest
    const siblingGroups = await prisma.group.findMany({
      where: {
        contestId: sourceGroup.contestId,
        id: { not: sourceGroupId },
        memberships: {
          some: { userId: session.user.id },
        },
      },
      select: { id: true },
    });

    if (siblingGroups.length === 0) {
      return NextResponse.json(
        { error: "No other groups found for this contest" },
        { status: 404 },
      );
    }

    // Get the source predictions to sync
    const sourceFilter: { groupId: string; userId: string; matchId?: string } = {
      groupId: sourceGroupId,
      userId: session.user.id,
    };
    if (matchId) {
      sourceFilter.matchId = matchId;
    }

    const sourcePredictions = await prisma.prediction.findMany({
      where: sourceFilter,
      select: {
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        match: {
          select: {
            id: true,
            kickoffTime: true,
            status: true,
          },
        },
      },
    });

    if (sourcePredictions.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "No predictions to sync",
      });
    }

    // Filter to only unlocked matches
    const now = new Date();
    const lockedStatuses = ["IN_PLAY", "PAUSED", "FINISHED", "AWARDED"];
    const syncablePredictions = sourcePredictions.filter(
      (p) => p.match.kickoffTime > now && !lockedStatuses.includes(p.match.status),
    );

    if (syncablePredictions.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "All matches have already kicked off",
      });
    }

    // Upsert predictions for each sibling group
    const targetGroupIds = siblingGroups.map((g) => g.id);
    let syncedCount = 0;

    const upsertOps = [];
    for (const pred of syncablePredictions) {
      for (const targetGroupId of targetGroupIds) {
        upsertOps.push(
          prisma.prediction.upsert({
            where: {
              userId_groupId_matchId: {
                userId: session.user.id,
                groupId: targetGroupId,
                matchId: pred.matchId,
              },
            },
            update: {
              homeGoals: pred.homeGoals,
              awayGoals: pred.awayGoals,
            },
            create: {
              userId: session.user.id,
              groupId: targetGroupId,
              matchId: pred.matchId,
              homeGoals: pred.homeGoals,
              awayGoals: pred.awayGoals,
            },
          }),
        );
      }
    }

    const results = await prisma.$transaction(upsertOps);
    syncedCount = results.length;

    return NextResponse.json({
      synced: syncedCount,
      groups: siblingGroups.length,
      predictions: syncablePredictions.length,
    });
  } catch (error) {
    console.error("Failed to sync predictions:", error);
    return NextResponse.json({ error: "Failed to sync predictions" }, { status: 500 });
  }
}
