import { extractInvoice } from '../src/agents/tools/extractInvoice';
import { matchPurchaseOrder } from '../src/agents/tools/matchPurchaseOrder';

const TENANT_ID = '7d58b73f-ac71-4ca8-ba7b-8f859890ed8c'; // Northwind Distributors
const PO_ID = '9f41edc2-4d56-4283-8dba-527858a97036'; // Garmin Fenix PO

async function main() {
  console.log('Step 1: Extracting invoice via Textract...');
  const invoice = await extractInvoice('nexusretail-dev-invoices-102268067799', 'test-invoice.pdf');
  console.log(JSON.stringify(invoice, null, 2));

  console.log('\nStep 2: Matching against Purchase Order...');
  const result = await matchPurchaseOrder(TENANT_ID, PO_ID, invoice);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});