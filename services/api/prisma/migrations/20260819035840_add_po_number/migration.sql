-- AlterTable: add column as nullable first
ALTER TABLE "purchase_orders" ADD COLUMN     "poNumber" TEXT;

-- Backfill existing rows with placeholder PO numbers
UPDATE "purchase_orders" SET "poNumber" = 'LEGACY-' || substring(id, 1, 8) WHERE "poNumber" IS NULL;

-- Now make it required
ALTER TABLE "purchase_orders" ALTER COLUMN "poNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_poNumber_key" ON "purchase_orders"("tenantId", "poNumber");