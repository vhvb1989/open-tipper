import PredictionsTab from "@/components/PredictionsTab";

/**
 * Group Page — Predictions Tab (default)
 *
 * Shows matches for the group's contest with score prediction inputs.
 * Auto-saves predictions on input; locks after kick-off.
 */
export default async function GroupPredictionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PredictionsTab groupId={id} />;
}
