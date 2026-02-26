import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import crypto from "crypto";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/:id/invite-link
 *
 * Regenerate the group's invite code (admin only).
 * The old invite link immediately becomes invalid.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Verify the user is an admin of this group
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    if (membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can regenerate invite links" },
        { status: 403 },
      );
    }

    // Generate a new unique invite code (URL-safe, 24 chars)
    const newInviteCode = crypto.randomBytes(18).toString("base64url");

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: newInviteCode },
      select: { inviteCode: true },
    });

    return NextResponse.json({ inviteCode: updatedGroup.inviteCode });
  } catch (error) {
    console.error("Failed to regenerate invite link:", error);
    return NextResponse.json({ error: "Failed to regenerate invite link" }, { status: 500 });
  }
}
