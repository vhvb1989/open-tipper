-- AlterTable: Add bonus_enabled_at timestamp to scoring_rules
-- Tracks when the unique bonus feature was enabled so that only matches
-- kicking off after this date receive the bonus calculation.
ALTER TABLE "scoring_rules" ADD COLUMN "bonus_enabled_at" TIMESTAMP(3);
