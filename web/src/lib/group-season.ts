import { ContestStatus } from "@/generated/prisma/client";

/**
 * User-facing message returned when a write is attempted against a group whose
 * season is over. Such groups are archived as a read-only historical record.
 */
export const ARCHIVED_GROUP_MESSAGE =
  "This group's season is over. It is archived as a read-only record — create a new-season group to keep playing.";

/**
 * A group is archived (read-only) when its contest's season is COMPLETED.
 *
 * Archived groups reject new predictions, risks and podium changes but stay
 * fully viewable so members can browse standings and history.
 */
export function isContestArchived(status: ContestStatus | string | null | undefined): boolean {
  return status === ContestStatus.COMPLETED;
}
