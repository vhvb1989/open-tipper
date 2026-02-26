import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/:id/join
 *
 * Join a group. For public groups, anyone can join directly.
 * For private groups, an invite code is required.
 *
 * Body: { inviteCode?: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, visibility: true, inviteCode: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check if already a member
    const existing = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already a member of this group" }, { status: 409 });
    }

    // Private groups require invite code
    if (group.visibility === "PRIVATE") {
      const body = await request.json().catch(() => ({}));
      if (!body.inviteCode || body.inviteCode !== group.inviteCode) {
        return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
      }
    }

    const membership = await prisma.membership.create({
      data: {
        userId: session.user.id,
        groupId: id,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    console.error("Failed to join group:", error);
    return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
  }
}
