import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function updateStock(
  tenantId: string,
  purchaseOrderId: string
): Promise<{ updated: { productId: string; newQuantity: number }[] }> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: { include: { product: { include: { stockLevels: true } } } } },
  });

  if (!po || po.tenantId !== tenantId) {
    throw new Error('Purchase order not found for this tenant');
  }

  if (po.status === 'closed') {
    throw new Error('This purchase order has already been closed');
  }

  const updated: { productId: string; newQuantity: number }[] = [];

  for (const item of po.items) {
    const stockLevel = item.product.stockLevels[0];
    if (!stockLevel) continue;

    const newQty = stockLevel.quantityOnHand + item.expectedQty;

    await prisma.stockLevel.update({
      where: { id: stockLevel.id },
      data: { quantityOnHand: newQty },
    });

    updated.push({ productId: item.productId, newQuantity: newQty });
  }

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: 'closed' },
  });

  return { updated };
}