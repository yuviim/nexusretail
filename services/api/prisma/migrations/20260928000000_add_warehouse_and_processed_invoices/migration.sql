-- AlterTable: which warehouse receives stock on approval. Nullable — existing
-- POs predate this column, and approve() requires it be set (already, or
-- passed in on the call) before it will touch stock.
ALTER TABLE "purchase_orders" ADD COLUMN     "warehouseId" TEXT;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: one row per invoice file actually processed for a tenant,
-- keyed by a hash of the file bytes. Re-uploading the identical file is
-- rejected before it reaches Textract or touches a PO a second time.
CREATE TABLE "processed_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_invoices_tenantId_fileHash_key" ON "processed_invoices"("tenantId", "fileHash");

-- AddForeignKey
ALTER TABLE "processed_invoices" ADD CONSTRAINT "processed_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_invoices" ADD CONSTRAINT "processed_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
