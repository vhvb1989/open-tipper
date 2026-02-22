import { auth } from "@/lib/auth";
import ResultsTab from "@/components/ResultsTab";

/**
 * Group Page — Results Tab
 *
 * Shows completed matches with each member's prediction and points awarded.
 */
export default async function GroupResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
  await auth(); // ensure authenticated
  return <ResultsTab groupId={groupId} />;
}
