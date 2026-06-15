-- AlterTable: Add unique bonus fields to scoring_rules
ALTER TABLE "scoring_rules" ADD COLUMN "unique_bonus_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scoring_rules" ADD COLUMN "unique_bonus_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0;

-- AlterTable: Add bonus tracking fields to predictions
ALTER TABLE "predictions" ADD COLUMN "bonus_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "predictions" ADD COLUMN "is_backfilled" BOOLEAN NOT NULL DEFAULT false;
