import { prisma } from '../../prisma';

export async function updateStock(
  tenantId: string,
  purchaseOrderId: string,
  warehouseId?: string
): Promise<{ updated: { productId: string; newQuantity: number }[] }> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });

  if (!po || po.tenantId !== tenantId) {
    throw new Error('Purchase order not found for this tenant');
  }

  // Approve used to only reject a PO that was already 'closed', which meant
  // it also happily accepted a PO that had never been matched against any
  // invoice at all ('open'). Only a PO Textract has actually reconciled
  // (matched or flagged, so a human can override a flag) is approvable.
  if (po.status !== 'matched' && po.status !== 'flagged') {
    throw new Error('This purchase order has no matched invoice to approve yet');
  }

  const targetWarehouseId = warehouseId || po.warehouseId;
  if (!targetWarehouseId) {
    throw new Error('No warehouse specified for this purchase order — pass warehouseId to approve it');
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } });
  if (!warehouse || warehouse.tenantId !== tenantId) {
    throw new Error('Warehouse not found for this tenant');
  }

  // Everything below — the closed-check-and-flip and every stock write —
  // happens in one transaction. Previously two concurrent approve calls
  // could both read status !== 'closed', both pass, and both add the
  // stock: a straight read-then-write race. The conditional updateMany
  // (WHERE status IN ('matched','flagged')) makes the status flip
  // atomic — only one of two racing calls can ever flip it, and the
  // other sees count 0 and aborts before touching stock. A partial
  // failure mid-loop now rolls the whole thing back instead of leaving
  // some products updated and the PO still open.
  return prisma.$transaction(async (tx) => {
    const claim = await tx.purchaseOrder.updateMany({
      where: { id: purchaseOrderId, status: { in: ['matched', 'flagged'] } },
      data: { status: 'closed', warehouseId: targetWarehouseId },
    });

    if (claim.count === 0) {
      throw new Error('This purchase order was already approved or closed by another request');
    }

    const updated: { productId: string; newQuantity: number }[] = [];

    for (const item of po.items) {
      const stockLevel = await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: targetWarehouseId } },
        update: { quantityOnHand: { increment: item.expectedQty } },
        create: { productId: item.productId, warehouseId: targetWarehouseId, quantityOnHand: item.expectedQty },
      });

      updated.push({ productId: item.productId, newQuantity: stockLevel.quantityOnHand });
    }

    return { updated };
  });
}
