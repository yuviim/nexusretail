import { extractInvoice } from '../src/agents/tools/extractInvoice';
import { findPurchaseOrderByNumber } from '../src/agents/tools/findPurchaseOrderByNumber';
import { matchPurchaseOrder } from '../src/agents/tools/matchPurchaseOrder';

const TENANT_ID = '7d58b73f-ac71-4ca8-ba7b-8f859890ed8c'; // Northwind Distributors

async function main() {
  console.log('Step 1: Extracting invoice via Textract (including PO number)...');
  const invoice = await extractInvoice('nexusretail-dev-invoices-102268067799', 'test-invoice-with-po.pdf');
  console.log(`  Extracted PO Number: ${invoice.poNumber}`);
  console.log(`  Vendor: ${invoice.vendorName}`);
  console.log(`  Line items: ${invoice.lineItems.length}`);

  if (!invoice.poNumber) {
    throw new Error('No PO number found on this invoice — cannot proceed automatically');
  }

  console.log(`\nStep 2: Looking up Purchase Order "${invoice.poNumber}" automatically (no manual ID passed)...`);
  const po = await findPurchaseOrderByNumber(TENANT_ID, invoice.poNumber);
  console.log(`  Found PO: ${po.id} (status: ${po.status})`);

  console.log('\nStep 3: Matching invoice against the automatically-found PO...');
  const result = await matchPurchaseOrder(TENANT_ID, po.id, invoice);
  console.log(`  Match status: ${result.status}`);
  console.log(JSON.stringify(result.lineResults, null, 2));

  console.log('\n✅ Fully automatic flow complete: invoice uploaded → PO number extracted → PO found → matched.');
  console.log('No PO ID was ever passed in manually.');
}

main().catch((err) => {
  console.error('Automatic flow failed:', err);
  process.exit(1);
});