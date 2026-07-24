-- CreateIndex
CREATE UNIQUE INDEX "groups_previous_group_id_contest_id_key" ON "groups"("previous_group_id", "contest_id");
