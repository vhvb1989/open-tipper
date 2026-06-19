import TrajectoryTab from "@/components/TrajectoryTab";

/**
 * Group Page — Trajectory Tab
 *
 * Shows a line chart with cumulative points over time for all group members.
 * Only visible to group members.
 */
export default async function GroupTrajectoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  return <TrajectoryTab groupId={groupId} />;
}
