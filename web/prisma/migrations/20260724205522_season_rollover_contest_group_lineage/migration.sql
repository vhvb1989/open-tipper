-- DropIndex
DROP INDEX "contests_externalId_key";

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "previous_group_id" TEXT;

-- CreateIndex
CREATE INDEX "contests_externalId_idx" ON "contests"("externalId");

-- CreateIndex
CREATE INDEX "groups_previous_group_id_idx" ON "groups"("previous_group_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_previous_group_id_fkey" FOREIGN KEY ("previous_group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
