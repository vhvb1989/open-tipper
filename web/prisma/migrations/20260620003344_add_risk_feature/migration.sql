-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('YELLOW_CARDS', 'RED_CARDS', 'CORNER_KICKS', 'OFFSIDES');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "risk_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "match_stats" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "yellow_cards" INTEGER,
    "red_cards" INTEGER,
    "corner_kicks" INTEGER,
    "offsides" INTEGER,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_predictions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "predicted_value" INTEGER NOT NULL,
    "points_risked" INTEGER NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'PENDING',
    "points_awarded" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "risk_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_stats_match_id_key" ON "match_stats"("match_id");

-- CreateIndex
CREATE INDEX "risk_predictions_group_id_idx" ON "risk_predictions"("group_id");

-- CreateIndex
CREATE INDEX "risk_predictions_match_id_idx" ON "risk_predictions"("match_id");

-- CreateIndex
CREATE INDEX "risk_predictions_user_id_idx" ON "risk_predictions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_predictions_user_id_group_id_match_id_category_key" ON "risk_predictions"("user_id", "group_id", "match_id", "category");

-- AddForeignKey
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_predictions" ADD CONSTRAINT "risk_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_predictions" ADD CONSTRAINT "risk_predictions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_predictions" ADD CONSTRAINT "risk_predictions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
