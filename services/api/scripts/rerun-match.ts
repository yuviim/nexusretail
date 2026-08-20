import { extractInvoice } from '../src/agents/tools/extractInvoice';
import { matchPurchaseOrder } from '../src/agents/tools/matchPurchaseOrder';

const TENANT_ID = '7d58b73f-ac71-4ca8-ba7b-8f859890ed8c';
const PO_ID = '22eff989-7a7b-4af0-b800-c84622c269d2'; // the flagged Paper cups PO

async function main() {
  const invoice = await extractInvoice('nexusretail-dev-invoices-102268067799', 'test-invoice.pdf');
  const result = await matchPurchaseOrder(TENANT_ID, PO_ID, invoice);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });