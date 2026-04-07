-- CreateEnum
CREATE TYPE "PodiumPosition" AS ENUM ('FIRST', 'SECOND', 'THIRD');

-- CreateTable
CREATE TABLE "podium_settings" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "first_place_points" INTEGER NOT NULL DEFAULT 100,
    "second_place_points" INTEGER NOT NULL DEFAULT 50,
    "third_place_points" INTEGER NOT NULL DEFAULT 100,
    "third_place_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podium_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "podium_predictions" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_place_team_id" TEXT NOT NULL,
    "second_place_team_id" TEXT NOT NULL,
    "third_place_team_id" TEXT,
    "first_place_points" INTEGER,
    "second_place_points" INTEGER,
    "third_place_points" INTEGER,
    "scored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podium_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "podium_badges" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" "PodiumPosition" NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podium_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "podium_settings_group_id_key" ON "podium_settings"("group_id");

-- CreateIndex
CREATE INDEX "podium_predictions_group_id_idx" ON "podium_predictions"("group_id");

-- CreateIndex
CREATE INDEX "podium_predictions_user_id_idx" ON "podium_predictions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "podium_predictions_user_id_group_id_key" ON "podium_predictions"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "podium_badges_group_id_idx" ON "podium_badges"("group_id");

-- CreateIndex
CREATE INDEX "podium_badges_user_id_idx" ON "podium_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "podium_badges_group_id_user_id_position_key" ON "podium_badges"("group_id", "user_id", "position");

-- AddForeignKey
ALTER TABLE "podium_settings" ADD CONSTRAINT "podium_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_predictions" ADD CONSTRAINT "podium_predictions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_predictions" ADD CONSTRAINT "podium_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_predictions" ADD CONSTRAINT "podium_predictions_first_place_team_id_fkey" FOREIGN KEY ("first_place_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_predictions" ADD CONSTRAINT "podium_predictions_second_place_team_id_fkey" FOREIGN KEY ("second_place_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_predictions" ADD CONSTRAINT "podium_predictions_third_place_team_id_fkey" FOREIGN KEY ("third_place_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_badges" ADD CONSTRAINT "podium_badges_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podium_badges" ADD CONSTRAINT "podium_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
