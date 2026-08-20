import { PrismaClient } from '@prisma/client';
import type { ExtractedInvoice, ExtractedLineItem } from './extractInvoice';

const prisma = new PrismaClient();

export interface MatchResult {
  purchaseOrderId: string;
  status: 'matched' | 'flagged';
  lineResults: LineMatchResult[];
}

export interface LineMatchResult {
  description: string;
  extractedQty: number | null;
  expectedQty: number;
  extractedUnitPrice: number | null;
  expectedUnitPrice: number;
  qtyMatch: boolean;
  priceMatch: boolean;
}

const PRICE_TOLERANCE = 0.01; // allow tiny rounding differences

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

  const lineResults: LineMatchResult[] = po.items.map((poItem) => {
    const extracted = findBestMatch(poItem.product.name, invoice.lineItems);
    const expectedUnitPrice = Number(poItem.expectedUnitPrice);

    const qtyMatch = extracted?.quantity === poItem.expectedQty;
    const priceMatch =
      extracted?.unitPrice != null &&
      Math.abs(extracted.unitPrice - expectedUnitPrice) <= PRICE_TOLERANCE;

    return {
      description: poItem.product.name,
      extractedQty: extracted?.quantity ?? null,
      expectedQty: poItem.expectedQty,
      extractedUnitPrice: extracted?.unitPrice ?? null,
      expectedUnitPrice,
      qtyMatch,
      priceMatch,
    };
  });

  const allMatch = lineResults.every((r) => r.qtyMatch && r.priceMatch);
  const status = allMatch ? 'matched' : 'flagged';

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status, matchDetails: lineResults as any },
  });

  return { purchaseOrderId, status, lineResults };
}

// Very simple fuzzy matcher — matches on substring overlap since
// Textract's OCR text won't be byte-identical to the product name in RDS.
function findBestMatch(productName: string, lineItems: ExtractedLineItem[]): ExtractedLineItem | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(productName);

  return (
    lineItems.find((item) => {
      const desc = normalize(item.description);
      return desc.includes(target) || target.includes(desc);
    }) ?? null
  );
}