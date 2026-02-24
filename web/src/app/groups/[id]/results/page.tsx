import ResultsTab from "@/components/ResultsTab";

/**
 * Group Page — Results Tab
 *
 * Shows completed matches with each member's prediction and points awarded.
 * For public groups, this is visible to non-members too.
 */
export default async function GroupResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
  return <ResultsTab groupId={groupId} />;
}
