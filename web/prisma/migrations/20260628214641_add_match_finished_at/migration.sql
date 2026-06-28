-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "finished_at" TIMESTAMP(3);

-- Backfill: anchor the minimum review wait for any match already observed
-- FINISHED. updatedAt is the best available proxy for when FT was detected.
UPDATE "matches"
SET "finished_at" = "updatedAt"
WHERE "status" IN ('FINISHED', 'AWARDED') AND "finished_at" IS NULL;
