import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PredictionsTab from "@/components/PredictionsTab";
import { redirect } from "next/navigation";

/**
 * Group Page — Predictions Tab (default)
 *
 * Shows matches for the group's contest with score prediction inputs.
 * Auto-saves predictions on input; locks after kick-off.
 *
 * For non-members of public groups, redirects to the standings tab instead.
 */
export default async function GroupPredictionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Check if user is a member of this group
  if (userId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (membership) {
      const group = await prisma.group.findUnique({
        where: { id },
        select: { podiumSettings: { select: { enabled: true } } },
      });
      return <PredictionsTab groupId={id} hasPodium={!!group?.podiumSettings?.enabled} />;
    }
  }

  // Non-members (or unauthenticated) viewing a public group: redirect to standings
  redirect(`/groups/${id}/standings`);
}
