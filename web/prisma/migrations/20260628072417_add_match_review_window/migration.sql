-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "review_poll_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "review_stable_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "risks_completed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: matches that already reached a terminal state were resolved under
-- the old immediate-resolution logic, so mark their review window as complete to
-- avoid re-entering review (and to keep resolution gating from blocking them).
UPDATE "matches"
SET "risks_completed" = true
WHERE "status" IN ('FINISHED', 'AWARDED', 'CANCELLED');
