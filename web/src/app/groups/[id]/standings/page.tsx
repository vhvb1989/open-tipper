import { auth } from "@/lib/auth";
import StandingsTab from "@/components/StandingsTab";

/**
 * Group Page — Standings Tab
 *
 * Ranked leaderboard showing total points, last-round points, and prediction count.
 * For public groups, this is visible to non-members too.
 */
export default async function GroupStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";

  const { id } = await params;
  return <StandingsTab groupId={id} currentUserId={currentUserId} />;
}
