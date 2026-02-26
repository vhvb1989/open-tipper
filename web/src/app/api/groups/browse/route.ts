import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/groups/browse
 *
 * Returns all public groups with contest info, member counts, and admin name.
 * If the user is authenticated, includes `isMember` flag per group.
 * Supports optional query params:
 *   - search: filter by group name (case-insensitive)
 *   - contestId: filter by contest
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const contestId = searchParams.get("contestId") || "";

    const where: Record<string, unknown> = {
      visibility: "PUBLIC",
    };

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (contestId) {
      where.contestId = contestId;
    }

    const groups = await prisma.group.findMany({
      where,
      include: {
        contest: {
          select: { id: true, name: true, code: true, season: true, emblem: true },
        },
        _count: { select: { memberships: true } },
        memberships: {
          where: { role: "ADMIN" },
          take: 1,
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    // Get all contests that have public groups (for filter dropdown)
    const contests = await prisma.contest.findMany({
      where: {
        groups: {
          some: { visibility: "PUBLIC" },
        },
      },
      select: { id: true, name: true, code: true, season: true },
      orderBy: { name: "asc" },
    });

    // If user is logged in, check which groups they're already a member of
    let memberGroupIds = new Set<string>();
    if (userId && groups.length > 0) {
      const memberships = await prisma.membership.findMany({
        where: {
          userId,
          groupId: { in: groups.map((g) => g.id) },
        },
        select: { groupId: true },
      });
      memberGroupIds = new Set(memberships.map((m) => m.groupId));
    }

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      contest: g.contest,
      memberCount: g._count.memberships,
      admin: g.memberships[0]?.user
        ? {
            id: g.memberships[0].user.id,
            name: g.memberships[0].user.name,
            image: g.memberships[0].user.image,
          }
        : null,
      isMember: memberGroupIds.has(g.id),
      createdAt: g.createdAt,
    }));

    return NextResponse.json({ groups: result, contests });
  } catch (error) {
    console.error("Failed to browse groups:", error);
    return NextResponse.json({ error: "Failed to browse groups" }, { status: 500 });
  }
}
