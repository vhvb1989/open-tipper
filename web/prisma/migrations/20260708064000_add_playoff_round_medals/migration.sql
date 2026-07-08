-- AlterTable: allow null match_day (playoff medals) and add round/stage columns
ALTER TABLE "medals" ALTER COLUMN "match_day" DROP NOT NULL,
ADD COLUMN "round" TEXT,
ADD COLUMN "stage" TEXT;

-- Backfill the round discriminator for existing match-day medals
UPDATE "medals" SET "round" = 'md:' || "match_day"::text WHERE "round" IS NULL;

-- Enforce NOT NULL on round now that existing rows are backfilled
ALTER TABLE "medals" ALTER COLUMN "round" SET NOT NULL;

-- DropIndex: old unique keyed on match_day
DROP INDEX "medals_group_id_user_id_match_day_key";

-- CreateIndex: new unique keyed on the round discriminator
CREATE UNIQUE INDEX "medals_group_id_user_id_round_key" ON "medals"("group_id", "user_id", "round");
