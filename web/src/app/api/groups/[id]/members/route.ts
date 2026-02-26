import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/members
 *
 * List all members of a group.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check group exists and user has access
    const group = await prisma.group.findUnique({
      where: { id },
      select: { visibility: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // For private groups, check membership
    if (group.visibility === "PRIVATE") {
      const membership = await prisma.membership.findUnique({
        where: { userId_groupId: { userId: session.user.id, groupId: id } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    }

    const members = await prisma.membership.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}
