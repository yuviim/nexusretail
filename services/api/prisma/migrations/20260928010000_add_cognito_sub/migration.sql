-- AlterTable: Cognito's immutable "sub" claim. Nullable — existing rows
-- need a one-time backfill (scripts/backfill-cognito-sub.ts) before
-- requireAuth's sub-based lookup will find them.
ALTER TABLE "users" ADD COLUMN     "cognitoSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoSub_key" ON "users"("cognitoSub");
