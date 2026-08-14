import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Tenant
  const tenant = await prisma.tenant.create({
    data: { name: 'Northwind Distributors' },
  });

  // Warehouses
  const mainWarehouse = await prisma.warehouse.create({
    data: { tenantId: tenant.id, name: 'Main warehouse' },
  });
  const eastDepot = await prisma.warehouse.create({
    data: { tenantId: tenant.id, name: 'East depot' },
  });

  // Products + stock levels (matching the inventory mockup)
  const products = [
    { sku: 'ESP-1KG', name: 'Espresso beans, 1kg', unitPrice: '9.40', reorderPoint: 40, warehouse: mainWarehouse, qty: 142 },
    { sku: 'OAT-1L', name: 'Oat milk, 1L', unitPrice: '3.20', reorderPoint: 25, warehouse: mainWarehouse, qty: 18 },
    { sku: 'CUP-12-100', name: 'Paper cups, 12oz (100pk)', unitPrice: '14.20', reorderPoint: 30, warehouse: eastDepot, qty: 0 },
    { sku: 'VAN-750', name: 'Vanilla syrup, 750ml', unitPrice: '8.50', reorderPoint: 20, warehouse: mainWarehouse, qty: 64 },
    { sku: 'NAP-500', name: 'Napkins, 500pk', unitPrice: '4.00', reorderPoint: 15, warehouse: eastDepot, qty: 9 },
  ];

  const createdProducts: Record<string, string> = {};

  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: p.sku,
        name: p.name,
        unitPrice: p.unitPrice,
        reorderPoint: p.reorderPoint,
      },
    });
    createdProducts[p.sku] = product.id;

    await prisma.stockLevel.create({
      data: {
        productId: product.id,
        warehouseId: p.warehouse.id,
        quantityOnHand: p.qty,
      },
    });
  }

  // Customers (matching the recent orders mockup)
  const greenLeaf = await prisma.customer.create({
    data: { tenantId: tenant.id, name: 'Green Leaf Cafe' },
  });
  const cornerMarket = await prisma.customer.create({
    data: { tenantId: tenant.id, name: 'Corner Market' },
  });
  const riversideDeli = await prisma.customer.create({
    data: { tenantId: tenant.id, name: 'Riverside Deli' },
  });

  // Orders (matching statuses from the order detail mockup)
  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerId: greenLeaf.id,
      status: 'fulfilled',
      items: {
        create: [
          { productId: createdProducts['ESP-1KG'], quantity: 12, unitPrice: '9.40' },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerId: cornerMarket.id,
      status: 'stock_reserved',
      items: {
        create: [
          { productId: createdProducts['OAT-1L'], quantity: 4, unitPrice: '3.20' },
          { productId: createdProducts['VAN-750'], quantity: 1, unitPrice: '8.50' },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerId: riversideDeli.id,
      status: 'fulfilled',
      items: {
        create: [
          { productId: createdProducts['ESP-1KG'], quantity: 21, unitPrice: '9.40' },
        ],
      },
    },
  });

  // Supplier (matching the invoice review mockup)
  await prisma.supplier.create({
    data: { tenantId: tenant.id, name: 'Sunrise Coffee Supply Co' },
  });

  console.log('Seed complete:', { tenantId: tenant.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
