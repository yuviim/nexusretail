import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const po = await prisma.purchaseOrder.update({
    where: { id: 'b5885613-e6f5-4185-9b5e-8c054f2bc82e' }, // the open Garmin PO from this morning
    data: { poNumber: 'PO-1001' },
  });
  console.log('Updated:', po.id, po.poNumber);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());