import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: 'Northwind Distributors' } });
  if (!tenant) throw new Error('Northwind tenant not found — check seed data');

  const supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id } });
  if (!supplier) throw new Error('No supplier found for this tenant');

  const product = await prisma.product.findFirst({ where: { tenantId: tenant.id } });
  if (!product) throw new Error('No product found for this tenant');

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      status: 'open',
      items: {
        create: [
          {
            productId: product.id,
            expectedQty: 9,
            expectedUnitPrice: '74120.00',
          },
        ],
      },
    },
    include: { items: true },
  });

  console.log('Test PO created:', JSON.stringify(po, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());