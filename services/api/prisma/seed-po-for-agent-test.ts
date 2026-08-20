import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: 'Northwind Distributors' } });
  if (!tenant) throw new Error('Tenant not found');

  const supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id } });
  if (!supplier) throw new Error('Supplier not found');

  const product = await prisma.product.findFirst({ where: { sku: 'GARMIN-FENIX7' } });
  if (!product) throw new Error('Garmin product not found — did you run the earlier seed script?');

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      status: 'open',
      items: {
        create: [{ productId: product.id, expectedQty: 9, expectedUnitPrice: '74120.00' }],
      },
    },
  });

  console.log('Fresh PO for agent test:', po.id);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());