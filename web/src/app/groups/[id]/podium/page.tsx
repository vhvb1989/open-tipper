import { auth } from "@/lib/auth";
import PodiumTab from "@/components/PodiumTab";

/**
 * Group Page — Podium Tab
 *
 * Predict the tournament's 1st, 2nd, and 3rd place finishers.
 * Shows team selectors before the tournament starts and results after it ends.
 */
export default async function GroupPodiumPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";

  const { id } = await params;
  return <PodiumTab groupId={id} currentUserId={currentUserId} />;
}
