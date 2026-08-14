import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: 'Riverside Wholesale' },
  });

  const warehouse = await prisma.warehouse.create({
    data: { tenantId: tenant.id, name: 'Central warehouse' },
  });

  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: 'RW-BOX-01',
      name: 'Shipping boxes, medium (50pk)',
      unitPrice: '22.00',
      reorderPoint: 10,
    },
  });

  await prisma.stockLevel.create({
    data: { productId: product.id, warehouseId: warehouse.id, quantityOnHand: 34 },
  });

  const customer = await prisma.customer.create({
    data: { tenantId: tenant.id, name: 'Bayview Hardware' },
  });

  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      status: 'placed',
      items: { create: [{ productId: product.id, quantity: 5, unitPrice: '22.00' }] },
    },
  });

  console.log('Second tenant seeded:', { tenantId: tenant.id, name: tenant.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
