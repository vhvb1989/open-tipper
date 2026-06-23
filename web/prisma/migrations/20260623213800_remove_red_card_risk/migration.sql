-- The red-card "yes/no" market has been removed from the risk feature.
-- Drop any existing red-card risk predictions before removing the enum value.
DELETE FROM "risk_predictions" WHERE "category" = 'RED_CARDS';

-- AlterEnum
BEGIN;
CREATE TYPE "RiskCategory_new" AS ENUM ('YELLOW_CARDS', 'CORNER_KICKS', 'OFFSIDES');
ALTER TABLE "risk_predictions" ALTER COLUMN "category" TYPE "RiskCategory_new" USING ("category"::text::"RiskCategory_new");
ALTER TYPE "RiskCategory" RENAME TO "RiskCategory_old";
ALTER TYPE "RiskCategory_new" RENAME TO "RiskCategory";
DROP TYPE "RiskCategory_old";
COMMIT;
