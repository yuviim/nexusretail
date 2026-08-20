import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function findPurchaseOrderByNumber(tenantId: string, poNumber: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { tenantId_poNumber: { tenantId, poNumber } },
  });

  if (!po) {
    throw new Error(`No purchase order found with number "${poNumber}" for this tenant`);
  }

  return po;
}