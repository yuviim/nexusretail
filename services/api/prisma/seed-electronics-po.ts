import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: 'Northwind Distributors' } });
  if (!tenant) throw new Error('Tenant not found');

  const supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id } });
  if (!supplier) throw new Error('Supplier not found');

  const warehouse = await prisma.warehouse.findFirst({ where: { tenantId: tenant.id } });
  if (!warehouse) throw new Error('Warehouse not found');

  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: 'GARMIN-FENIX7',
      name: 'Garmin Fenix 7 Solar Multisport GPS',
      unitPrice: '74120.00',
      reorderPoint: 5,
      stockLevels: { create: [{ warehouseId: warehouse.id, quantityOnHand: 0 }] },
    },
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      status: 'open',
      items: {
        create: [{ productId: product.id, expectedQty: 9, expectedUnitPrice: '74120.00' }],
      },
    },
    include: { items: true },
  });

  console.log('New PO for matching test:', po.id);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());