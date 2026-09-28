import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Every row below gets a fixed, hardcoded id and is written with upsert, so
// running this script twice (or a hundred times) leaves the database in the
// same state instead of piling up duplicate tenants/orders each time. This
// also makes cross-references (order -> product, PO -> product, etc.)
// legible in this file instead of chained off whatever create() happened to
// return last time.
//
// Two tenants exist on purpose — one isn't enough to demonstrate that
// tenant isolation actually works, and every route that scopes by tenantId
// should be checkable by trying to reach the other tenant's data and being
// refused.
//
// Every seeded user has a fixed cognitoSub. These are NOT real Cognito
// subject claims — in a real (non-local) environment a user's sub comes
// from Cognito itself and these values mean nothing to it. They exist so
// AUTH_MODE=local (see src/middleware/auth.ts) has something fixed to map
// a local dev token onto, without needing a real Cognito user pool to run
// the app locally at all.

const NORTHWIND_TENANT_ID = 'a0000000-0000-4000-8000-000000000001';
const RIVERSIDE_TENANT_ID = 'a0000000-0000-4000-8000-000000000002';

async function main() {
  // ---- Tenants ----
  const northwind = await prisma.tenant.upsert({
    where: { id: NORTHWIND_TENANT_ID },
    update: {},
    create: { id: NORTHWIND_TENANT_ID, slug: 'northwind', name: 'Northwind Distributors' },
  });

  const riverside = await prisma.tenant.upsert({
    where: { id: RIVERSIDE_TENANT_ID },
    update: {},
    create: { id: RIVERSIDE_TENANT_ID, slug: 'riverside', name: 'Riverside Retail Group' },
  });

  // ---- Users (one owner/staff/read_only per tenant, fixed cognitoSub) ----
  const users = [
    { id: 'b0000000-0000-4000-8000-000000000001', tenantId: northwind.id, email: 'owner@northwind.test', name: 'Nora Owner', role: 'owner', cognitoSub: 'c0000000-0000-4000-8000-000000000001' },
    { id: 'b0000000-0000-4000-8000-000000000002', tenantId: northwind.id, email: 'staff@northwind.test', name: 'Sam Staff', role: 'staff', cognitoSub: 'c0000000-0000-4000-8000-000000000002' },
    { id: 'b0000000-0000-4000-8000-000000000003', tenantId: northwind.id, email: 'viewer@northwind.test', name: 'Val Viewer', role: 'read_only', cognitoSub: 'c0000000-0000-4000-8000-000000000003' },
    { id: 'b0000000-0000-4000-8000-000000000004', tenantId: riverside.id, email: 'owner@riverside.test', name: 'Rita Owner', role: 'owner', cognitoSub: 'c0000000-0000-4000-8000-000000000004' },
    { id: 'b0000000-0000-4000-8000-000000000005', tenantId: riverside.id, email: 'staff@riverside.test', name: 'Ravi Staff', role: 'staff', cognitoSub: 'c0000000-0000-4000-8000-000000000005' },
    { id: 'b0000000-0000-4000-8000-000000000006', tenantId: riverside.id, email: 'viewer@riverside.test', name: 'Rin Viewer', role: 'read_only', cognitoSub: 'c0000000-0000-4000-8000-000000000006' },
  ];

  for (const u of users) {
    await prisma.user.upsert({ where: { id: u.id }, update: u, create: u });
  }

  // ---- Warehouses ----
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { id: 'd0000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: 'd0000000-0000-4000-8000-000000000001', tenantId: northwind.id, name: 'Main warehouse' },
  });
  const eastDepot = await prisma.warehouse.upsert({
    where: { id: 'd0000000-0000-4000-8000-000000000002' },
    update: {},
    create: { id: 'd0000000-0000-4000-8000-000000000002', tenantId: northwind.id, name: 'East depot' },
  });
  const riversideWarehouse = await prisma.warehouse.upsert({
    where: { id: 'd0000000-0000-4000-8000-000000000003' },
    update: {},
    create: { id: 'd0000000-0000-4000-8000-000000000003', tenantId: riverside.id, name: 'Riverside main' },
  });

  // ---- Products + stock levels (northwind — matches the inventory mockup) ----
  const products = [
    { id: 'e0000000-0000-4000-8000-000000000001', sku: 'ESP-1KG', name: 'Espresso beans, 1kg', unitPrice: '9.40', reorderPoint: 40, warehouse: mainWarehouse, qty: 142 },
    { id: 'e0000000-0000-4000-8000-000000000002', sku: 'OAT-1L', name: 'Oat milk, 1L', unitPrice: '3.20', reorderPoint: 25, warehouse: mainWarehouse, qty: 18 },
    { id: 'e0000000-0000-4000-8000-000000000003', sku: 'CUP-12-100', name: 'Paper cups, 12oz (100pk)', unitPrice: '14.20', reorderPoint: 30, warehouse: eastDepot, qty: 0 },
    { id: 'e0000000-0000-4000-8000-000000000004', sku: 'VAN-750', name: 'Vanilla syrup, 750ml', unitPrice: '8.50', reorderPoint: 20, warehouse: mainWarehouse, qty: 64 },
    { id: 'e0000000-0000-4000-8000-000000000005', sku: 'NAP-500', name: 'Napkins, 500pk', unitPrice: '4.00', reorderPoint: 15, warehouse: eastDepot, qty: 9 },
  ];

  const productById: Record<string, string> = {};

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: { id: p.id, tenantId: northwind.id, sku: p.sku, name: p.name, unitPrice: p.unitPrice, reorderPoint: p.reorderPoint },
    });
    productById[p.sku] = product.id;

    await prisma.stockLevel.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: p.warehouse.id } },
      update: { quantityOnHand: p.qty },
      create: { productId: product.id, warehouseId: p.warehouse.id, quantityOnHand: p.qty },
    });
  }

  // Riverside gets its own small, separate catalog — used to demonstrate
  // that a northwind user can't see or touch it.
  const riversideProduct = await prisma.product.upsert({
    where: { id: 'e0000000-0000-4000-8000-000000000006' },
    update: {},
    create: { id: 'e0000000-0000-4000-8000-000000000006', tenantId: riverside.id, sku: 'TOTE-RCY', name: 'Recycled tote bag', unitPrice: '6.00', reorderPoint: 20 },
  });
  await prisma.stockLevel.upsert({
    where: { productId_warehouseId: { productId: riversideProduct.id, warehouseId: riversideWarehouse.id } },
    update: { quantityOnHand: 200 },
    create: { productId: riversideProduct.id, warehouseId: riversideWarehouse.id, quantityOnHand: 200 },
  });

  // ---- Customers (northwind — matches the recent orders mockup) ----
  const greenLeaf = await prisma.customer.upsert({
    where: { id: 'f0000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: 'f0000000-0000-4000-8000-000000000001', tenantId: northwind.id, name: 'Green Leaf Cafe' },
  });
  const cornerMarket = await prisma.customer.upsert({
    where: { id: 'f0000000-0000-4000-8000-000000000002' },
    update: {},
    create: { id: 'f0000000-0000-4000-8000-000000000002', tenantId: northwind.id, name: 'Corner Market' },
  });
  const riversideDeli = await prisma.customer.upsert({
    where: { id: 'f0000000-0000-4000-8000-000000000003' },
    update: {},
    create: { id: 'f0000000-0000-4000-8000-000000000003', tenantId: northwind.id, name: 'Riverside Deli' },
  });
  const riversideCustomer = await prisma.customer.upsert({
    where: { id: 'f0000000-0000-4000-8000-000000000004' },
    update: {},
    create: { id: 'f0000000-0000-4000-8000-000000000004', tenantId: riverside.id, name: 'Harborview Grocers' },
  });

  // ---- Orders (northwind — matches statuses from the order detail mockup) ----
  await prisma.order.upsert({
    where: { id: '10000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '10000000-0000-4000-8000-000000000001',
      tenantId: northwind.id,
      customerId: greenLeaf.id,
      status: 'fulfilled',
      items: { create: [{ id: '11000000-0000-4000-8000-000000000001', productId: productById['ESP-1KG'], quantity: 12, unitPrice: '9.40' }] },
    },
  });

  await prisma.order.upsert({
    where: { id: '10000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '10000000-0000-4000-8000-000000000002',
      tenantId: northwind.id,
      customerId: cornerMarket.id,
      status: 'stock_reserved',
      items: {
        create: [
          { id: '11000000-0000-4000-8000-000000000002', productId: productById['OAT-1L'], quantity: 4, unitPrice: '3.20' },
          { id: '11000000-0000-4000-8000-000000000003', productId: productById['VAN-750'], quantity: 1, unitPrice: '8.50' },
        ],
      },
    },
  });

  await prisma.order.upsert({
    where: { id: '10000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '10000000-0000-4000-8000-000000000003',
      tenantId: northwind.id,
      customerId: riversideDeli.id,
      status: 'fulfilled',
      items: { create: [{ id: '11000000-0000-4000-8000-000000000004', productId: productById['ESP-1KG'], quantity: 21, unitPrice: '9.40' }] },
    },
  });

  await prisma.order.upsert({
    where: { id: '10000000-0000-4000-8000-000000000004' },
    update: {},
    create: {
      id: '10000000-0000-4000-8000-000000000004',
      tenantId: riverside.id,
      customerId: riversideCustomer.id,
      status: 'placed',
      items: { create: [{ id: '11000000-0000-4000-8000-000000000005', productId: riversideProduct.id, quantity: 50, unitPrice: '6.00' }] },
    },
  });

  // ---- Supplier (northwind — matches the invoice review mockup) ----
  const supplier = await prisma.supplier.upsert({
    where: { id: '20000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: '20000000-0000-4000-8000-000000000001', tenantId: northwind.id, name: 'Sunrise Coffee Supply Co' },
  });
  const riversideSupplier = await prisma.supplier.upsert({
    where: { id: '20000000-0000-4000-8000-000000000002' },
    update: {},
    create: { id: '20000000-0000-4000-8000-000000000002', tenantId: riverside.id, name: 'Evergreen Packaging Co' },
  });
  void riversideSupplier;

  // ---- Purchase orders — each pairs with a sample invoice in samples/,
  // used with TEXTRACT_MODE=mock to demo all three match outcomes without
  // a real Textract call. See samples/README.md.
  await prisma.purchaseOrder.upsert({
    where: { id: '30000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000001',
      tenantId: northwind.id,
      poNumber: 'PO-1001',
      supplierId: supplier.id,
      warehouseId: mainWarehouse.id,
      status: 'open',
      items: { create: [{ id: '31000000-0000-4000-8000-000000000001', productId: productById['ESP-1KG'], expectedQty: 50, expectedUnitPrice: '9.40' }] },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { id: '30000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000002',
      tenantId: northwind.id,
      poNumber: 'PO-1002',
      supplierId: supplier.id,
      warehouseId: mainWarehouse.id,
      status: 'open',
      items: { create: [{ id: '31000000-0000-4000-8000-000000000002', productId: productById['OAT-1L'], expectedQty: 100, expectedUnitPrice: '3.20' }] },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { id: '30000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000003',
      tenantId: northwind.id,
      poNumber: 'PO-1003',
      supplierId: supplier.id,
      warehouseId: mainWarehouse.id,
      status: 'open',
      items: { create: [{ id: '31000000-0000-4000-8000-000000000003', productId: productById['VAN-750'], expectedQty: 30, expectedUnitPrice: '8.50' }] },
    },
  });

  console.log('Seed complete:', {
    tenants: [northwind.id, riverside.id],
    users: users.map((u) => u.email),
    purchaseOrders: ['PO-1001 (clean match)', 'PO-1002 (price mismatch)', 'PO-1003 (extra line item)'],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
