import { extractInvoice } from '../src/agents/tools/extractInvoice';

async function main() {
  const result = await extractInvoice('nexusretail-dev-invoices-102268067799', 'test-invoice.pdf');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
