import { extractInvoice } from '../src/agents/tools/extractInvoice';
import { matchPurchaseOrder } from '../src/agents/tools/matchPurchaseOrder';
import { updateStock } from '../src/agents/tools/updateStock';

const TENANT_ID = '7d58b73f-ac71-4ca8-ba7b-8f859890ed8c'; // Northwind Distributors
const PO_ID = '9f41edc2-4d56-4283-8dba-527858a97036'; // Garmin Fenix PO

async function main() {
  console.log('Step 1: Extracting invoice via Textract...');
  const invoice = await extractInvoice('nexusretail-dev-invoices-102268067799', 'test-invoice.pdf');
  console.log(`  Extracted ${invoice.lineItems.length} line items from ${invoice.vendorName}`);

  console.log('\nStep 2: Matching against Purchase Order...');
  const match = await matchPurchaseOrder(TENANT_ID, PO_ID, invoice);
  console.log(`  Match status: ${match.status}`);

  if (match.status !== 'matched') {
    console.log('  Mismatch detected — in a real flow, this would stop here and wait for human review.');
    console.log(JSON.stringify(match.lineResults, null, 2));
    return;
  }

  console.log('\nStep 3: All items matched — updating stock levels...');
  const stockResult = await updateStock(TENANT_ID, PO_ID);
  console.log('  Stock updated:', JSON.stringify(stockResult, null, 2));

  console.log('\n✅ Full pipeline complete: PDF invoice → extraction → matching → stock update.');
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});