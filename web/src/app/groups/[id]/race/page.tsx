import RaceTab from "@/components/RaceTab";

/**
 * Group Page — Race Tab
 *
 * Bar-chart-race animation of cumulative standings over time, replaying
 * the standing of each member match by match. Only visible to group members.
 */
export default async function GroupRacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  return <RaceTab groupId={groupId} />;
}
