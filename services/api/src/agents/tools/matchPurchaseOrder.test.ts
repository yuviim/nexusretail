import { describe, it, expect } from 'vitest';
import { computeLineMatches, type PoItemForMatching } from './matchLogic';
import type { ExtractedInvoice } from './extractInvoice';

function invoice(lineItems: ExtractedInvoice['lineItems'], totalAmount: number | null = null): ExtractedInvoice {
  return { vendorName: 'Test Vendor', invoiceDate: null, poNumber: 'PO-1', totalAmount, lineItems };
}

function poItem(overrides: Partial<PoItemForMatching> = {}): PoItemForMatching {
  return {
    productId: 'p1',
    productName: 'Espresso beans, 1kg',
    expectedQty: 10,
    expectedUnitPrice: 25,
    ...overrides,
  };
}

describe('computeLineMatches', () => {
  it('matches when quantity and price both line up', () => {
    const { lineResults, extraLineItems } = computeLineMatches(
      [poItem()],
      invoice([{ description: 'Espresso beans, 1kg', quantity: 10, unitPrice: 25, totalPrice: 250 }])
    );
    expect(lineResults[0].qtyMatch).toBe(true);
    expect(lineResults[0].priceMatch).toBe(true);
    expect(extraLineItems).toHaveLength(0);
  });

  it('flags a quantity mismatch', () => {
    const { lineResults } = computeLineMatches(
      [poItem({ expectedQty: 10 })],
      invoice([{ description: 'Espresso beans, 1kg', quantity: 7, unitPrice: 25, totalPrice: 175 }])
    );
    expect(lineResults[0].qtyMatch).toBe(false);
  });

  it('surfaces an invoice line with no matching PO item as extra, not silently dropped', () => {
    const { lineResults, extraLineItems } = computeLineMatches(
      [poItem()],
      invoice([
        { description: 'Espresso beans, 1kg', quantity: 10, unitPrice: 25, totalPrice: 250 },
        { description: 'Surprise delivery fee', quantity: 1, unitPrice: 15, totalPrice: 15 },
      ])
    );
    expect(lineResults.every((r) => r.qtyMatch && r.priceMatch)).toBe(true);
    expect(extraLineItems).toHaveLength(1);
    expect(extraLineItems[0].description).toBe('Surprise delivery fee');
  });

  it('does not let two different PO items both claim the same invoice line', () => {
    // Regression case from the review: "Cable" would previously match both
    // "HDMI Cable 2m" and "USB Cable" independently, because each PO item
    // searched the whole invoice from scratch.
    const poItems = [
      poItem({ productId: 'p1', productName: 'HDMI Cable 2m', expectedQty: 5, expectedUnitPrice: 4 }),
      poItem({ productId: 'p2', productName: 'USB Cable', expectedQty: 3, expectedUnitPrice: 3 }),
    ];
    const { lineResults, extraLineItems } = computeLineMatches(
      poItems,
      invoice([{ description: 'USB Cable', quantity: 3, unitPrice: 3, totalPrice: 9 }])
    );
    // Only one PO item can consume the single "USB Cable" line; the other
    // must come back with no match rather than a false-positive match.
    const matchedCount = lineResults.filter((r) => r.extractedQty !== null).length;
    expect(matchedCount).toBe(1);
    expect(extraLineItems).toHaveLength(0);
  });

  it('flags when the invoice total does not add up to the PO total', () => {
    const { invoiceTotalMatch } = computeLineMatches(
      [poItem({ expectedQty: 10, expectedUnitPrice: 25 })], // expected total 250
      invoice([{ description: 'Espresso beans, 1kg', quantity: 10, unitPrice: 25, totalPrice: 250 }], 400)
    );
    expect(invoiceTotalMatch).toBe(false);
  });

  it('treats a missing invoice total as unknown, not a mismatch', () => {
    const { invoiceTotalMatch } = computeLineMatches(
      [poItem()],
      invoice([{ description: 'Espresso beans, 1kg', quantity: 10, unitPrice: 25, totalPrice: 250 }], null)
    );
    expect(invoiceTotalMatch).toBeNull();
  });
});
