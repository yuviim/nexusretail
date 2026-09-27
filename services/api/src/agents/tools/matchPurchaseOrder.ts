import { prisma } from '../../prisma';
import type { ExtractedInvoice, ExtractedLineItem } from './extractInvoice';
import { computeLineMatches, isFullMatch, type LineMatchResult, type PoItemForMatching } from './matchLogic';

export type { LineMatchResult, PoItemForMatching };

export interface MatchResult {
  purchaseOrderId: string;
  status: 'matched' | 'flagged';
  lineResults: LineMatchResult[];
  extraLineItems: ExtractedLineItem[];
  invoiceTotalMatch: boolean | null;
}

export async function matchPurchaseOrder(
  tenantId: string,
  purchaseOrderId: string,
  invoice: ExtractedInvoice
): Promise<MatchResult> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: { include: { product: true } } },
  });

  if (!po || po.tenantId !== tenantId) {
    throw new Error('Purchase order not found for this tenant');
  }

  const poItems: PoItemForMatching[] = po.items.map((poItem) => ({
    productId: poItem.productId,
    productName: poItem.product.name,
    expectedQty: poItem.expectedQty,
    expectedUnitPrice: Number(poItem.expectedUnitPrice),
  }));

  const { lineResults, extraLineItems, invoiceTotalMatch } = computeLineMatches(poItems, invoice);
  const status = isFullMatch(lineResults, extraLineItems, invoiceTotalMatch) ? 'matched' : 'flagged';

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status, matchDetails: { lineResults, extraLineItems, invoiceTotalMatch } as any },
  });

  return { purchaseOrderId, status, lineResults, extraLineItems, invoiceTotalMatch };
}
