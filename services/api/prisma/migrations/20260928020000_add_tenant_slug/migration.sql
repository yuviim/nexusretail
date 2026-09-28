-- Adds a stable, human-chosen key to tenants so seed scripts (and anything
-- else that needs an idempotent upsert) don't have to invent one out of
-- name or id. Backfills existing rows from a slugified name so the column
-- can be NOT NULL from the start.
ALTER TABLE "tenants" ADD COLUMN "slug" TEXT;

UPDATE "tenants"
SET "slug" = lower(regexp_replace(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || substr("id", 1, 8)
WHERE "slug" IS NULL;

ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
