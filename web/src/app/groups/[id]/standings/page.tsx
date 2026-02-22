import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import StandingsTab from "@/components/StandingsTab";

/**
 * Group Page — Standings Tab
 *
 * Ranked leaderboard showing total points, last-round points, and prediction count.
 */
export default async function GroupStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const { id } = await params;
  return <StandingsTab groupId={id} currentUserId={session.user.id} />;
}
