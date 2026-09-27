import type { ExtractedInvoice, ExtractedLineItem } from './extractInvoice';

// Pure matching logic, deliberately kept free of any Prisma/DB import so it
// can be unit tested (see matchPurchaseOrder.test.ts) without a database or
// a generated Prisma client. matchPurchaseOrder.ts is the thin DB-touching
// wrapper around this.

export interface LineMatchResult {
  description: string;
  extractedQty: number | null;
  expectedQty: number;
  extractedUnitPrice: number | null;
  expectedUnitPrice: number;
  qtyMatch: boolean;
  priceMatch: boolean;
}

export interface PoItemForMatching {
  productId: string;
  productName: string;
  expectedQty: number;
  expectedUnitPrice: number;
}

const PRICE_TOLERANCE = 0.01; // allow tiny rounding differences
const TOTAL_TOLERANCE = 0.01;

export function computeLineMatches(
  poItems: PoItemForMatching[],
  invoice: ExtractedInvoice
): { lineResults: LineMatchResult[]; extraLineItems: ExtractedLineItem[]; invoiceTotalMatch: boolean | null } {
  // The matcher used to only walk PO items and ask "is there an invoice
  // line for this?" — it never asked the reverse question, so an extra
  // line the supplier billed but that isn't on the PO (classic overbilling)
  // was invisible. Consuming each invoice line item out of a shared pool as
  // it gets matched makes both directions fall out of the same pass:
  // whatever's left in the pool at the end is unbilled-for-nothing, i.e.
  // extra.
  const pool = invoice.lineItems.slice();

  const lineResults: LineMatchResult[] = poItems.map((poItem) => {
    const matchIndex = findBestMatchIndex(poItem.productName, pool);
    const extracted = matchIndex === -1 ? null : pool[matchIndex];
    if (matchIndex !== -1) pool.splice(matchIndex, 1);

    const qtyMatch = extracted?.quantity === poItem.expectedQty;
    const priceMatch =
      extracted?.unitPrice != null &&
      Math.abs(extracted.unitPrice - poItem.expectedUnitPrice) <= PRICE_TOLERANCE;

    return {
      description: poItem.productName,
      extractedQty: extracted?.quantity ?? null,
      expectedQty: poItem.expectedQty,
      extractedUnitPrice: extracted?.unitPrice ?? null,
      expectedUnitPrice: poItem.expectedUnitPrice,
      qtyMatch,
      priceMatch,
    };
  });

  const expectedTotal = poItems.reduce((sum, i) => sum + i.expectedQty * i.expectedUnitPrice, 0);
  const invoiceTotalMatch =
    invoice.totalAmount == null ? null : Math.abs(invoice.totalAmount - expectedTotal) <= TOTAL_TOLERANCE;

  return { lineResults, extraLineItems: pool, invoiceTotalMatch };
}

export function isFullMatch(
  lineResults: LineMatchResult[],
  extraLineItems: ExtractedLineItem[],
  invoiceTotalMatch: boolean | null
): boolean {
  return (
    lineResults.every((r) => r.qtyMatch && r.priceMatch) &&
    extraLineItems.length === 0 &&
    invoiceTotalMatch !== false
  );
}

// Still a heuristic substring matcher, not a rewrite into something
// smarter — Textract OCR text won't be byte-identical to the product name
// in RDS, so exact equality alone would flag almost everything. Consuming
// matched items out of the pool (see computeLineMatches) at least stops
// the old failure mode where two different PO items ("HDMI Cable 2m" and
// "USB Cable") could both silently match the same single invoice line.
function findBestMatchIndex(productName: string, pool: ExtractedLineItem[]): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(productName);

  // Prefer an exact normalized match over a loose substring one, so
  // "Cable" doesn't grab "USB Cable" ahead of an invoice line that's
  // actually just "Cable".
  const exactIndex = pool.findIndex((item) => normalize(item.description) === target);
  if (exactIndex !== -1) return exactIndex;

  return pool.findIndex((item) => {
    const desc = normalize(item.description);
    return desc.includes(target) || target.includes(desc);
  });
}
