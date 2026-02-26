import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";

/**
 * GET /join/:inviteCode
 *
 * Handles invite link flow:
 * - Unauthenticated → redirect to sign in
 * - Already a member → redirect to group
 * - Valid invite → auto-join and redirect to group
 */
export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const session = await auth();
  const { inviteCode } = await params;

  // Find the group by invite code
  const group = await prisma.group.findUnique({
    where: { inviteCode },
    select: { id: true, name: true },
  });

  if (!group) {
    notFound();
  }

  // Not signed in → redirect to sign in, then back here
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/join/${inviteCode}`);
  }

  // Check if already a member
  const existing = await prisma.membership.findUnique({
    where: {
      userId_groupId: { userId: session.user.id, groupId: group.id },
    },
  });

  if (existing) {
    redirect(`/groups/${group.id}`);
  }

  // Join the group
  await prisma.membership.create({
    data: {
      userId: session.user.id,
      groupId: group.id,
      role: "MEMBER",
    },
  });

  redirect(`/groups/${group.id}`);
}
