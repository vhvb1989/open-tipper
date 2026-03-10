-- CreateTable
CREATE TABLE "medals" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_day" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medals_group_id_idx" ON "medals"("group_id");

-- CreateIndex
CREATE INDEX "medals_user_id_idx" ON "medals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "medals_group_id_user_id_match_day_key" ON "medals"("group_id", "user_id", "match_day");

-- AddForeignKey
ALTER TABLE "medals" ADD CONSTRAINT "medals_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medals" ADD CONSTRAINT "medals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
