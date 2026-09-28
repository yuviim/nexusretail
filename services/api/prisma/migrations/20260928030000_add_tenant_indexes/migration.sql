-- Every tenant-scoped query (nearly every route in index.ts) filters by
-- tenantId, and these five tables had no index covering that column at
-- all — every one of those queries was a full table scan. products,
-- purchase_orders, processed_invoices and stock_levels were already
-- covered incidentally (tenantId/productId happens to be the leading
-- column of an existing unique index there); these five weren't.
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX "warehouses_tenantId_idx" ON "warehouses"("tenantId");
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");
CREATE INDEX "orders_tenantId_idx" ON "orders"("tenantId");
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- order_items.orderId and stock_levels.warehouseId: same problem, one
-- level down. order_items had no index on orderId at all. stock_levels'
-- existing unique index is (productId, warehouseId) — usable for a
-- productId-leading lookup, not for "all stock rows in this warehouse"
-- (the reorder/inventory-by-warehouse queries), which needs warehouseId
-- as its own leading column.
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "stock_levels_warehouseId_idx" ON "stock_levels"("warehouseId");
