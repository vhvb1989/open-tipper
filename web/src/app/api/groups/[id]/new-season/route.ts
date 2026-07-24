import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/:id/new-season
 *
 * Clone a group into the current season of the same league. Admin-only.
 *
 * A season rollover never mutates the existing group — it stays as a read-only
 * archive. Instead this creates a brand-new group linked back to the source via
 * `previousGroupId`, copying:
 *   - the group settings (visibility, description, risk toggle, scoring rules,
 *     podium settings)
 *   - every membership (roles preserved)
 * The caller supplies a new name.
 *
 * Body: { name: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "A name for the new group is required" }, { status: 400 });
    }

    // Load the source group with everything we need to clone.
    const source = await prisma.group.findUnique({
      where: { id },
      include: {
        contest: { select: { id: true, code: true, season: true } },
        scoringRules: true,
        podiumSettings: true,
        memberships: { select: { userId: true, role: true } },
      },
    });
    if (!source) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Only an admin of the source group can start a new season.
    const isAdmin = source.memberships.some((m) => m.userId === userId && m.role === "ADMIN");
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only a group admin can start a new season" },
        { status: 403 },
      );
    }

    // Find the current (non-completed) contest for the same league.
    const targetContest = await prisma.contest.findFirst({
      where: {
        code: source.contest.code,
        id: { not: source.contest.id },
        status: { not: "COMPLETED" },
      },
      orderBy: { startDate: "desc" },
      select: { id: true, season: true },
    });
    if (!targetContest) {
      return NextResponse.json(
        { error: "No new season is available for this league yet" },
        { status: 400 },
      );
    }

    // Don't create duplicate lineage groups — if this group was already rolled
    // over, point the admin at the existing new-season group instead.
    const existing = await prisma.group.findFirst({
      where: { previousGroupId: source.id, contestId: targetContest.id },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "A group for the new season already exists",
          group: existing,
        },
        { status: 409 },
      );
    }

    const created = await prisma.group.create({
      data: {
        name,
        description: source.description,
        visibility: source.visibility,
        riskEnabled: source.riskEnabled,
        contestId: targetContest.id,
        previousGroupId: source.id,
        memberships: {
          create: source.memberships.map((m) => ({ userId: m.userId, role: m.role })),
        },
        ...(source.scoringRules
          ? {
              scoringRules: {
                create: {
                  exactScore: source.scoringRules.exactScore,
                  goalDifference: source.scoringRules.goalDifference,
                  outcome: source.scoringRules.outcome,
                  oneTeamGoals: source.scoringRules.oneTeamGoals,
                  totalGoals: source.scoringRules.totalGoals,
                  reverseGoalDifference: source.scoringRules.reverseGoalDifference,
                  accumulationMode: source.scoringRules.accumulationMode,
                  playoffMultiplier: source.scoringRules.playoffMultiplier,
                  uniqueBonusEnabled: source.scoringRules.uniqueBonusEnabled,
                  uniqueBonusMultiplier: source.scoringRules.uniqueBonusMultiplier,
                  ...(source.scoringRules.uniqueBonusEnabled ? { bonusEnabledAt: new Date() } : {}),
                },
              },
            }
          : {}),
        ...(source.podiumSettings
          ? {
              podiumSettings: {
                create: {
                  enabled: source.podiumSettings.enabled,
                  firstPlacePoints: source.podiumSettings.firstPlacePoints,
                  secondPlacePoints: source.podiumSettings.secondPlacePoints,
                  thirdPlacePoints: source.podiumSettings.thirdPlacePoints,
                  thirdPlaceEnabled: source.podiumSettings.thirdPlaceEnabled,
                },
              },
            }
          : {}),
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({ group: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to start new season:", error);
    return NextResponse.json({ error: "Failed to start new season" }, { status: 500 });
  }
}
