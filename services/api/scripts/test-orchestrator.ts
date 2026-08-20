import { runInvoiceOrchestrator } from '../src/agents/orchestrator';

const TENANT_ID = '7d58b73f-ac71-4ca8-ba7b-8f859890ed8c'; // Northwind Distributors
const PO_ID = 'b5885613-e6f5-4185-9b5e-8c054f2bc82e'; // fresh PO for this test

async function main() {
  console.log('Handing off to the orchestrator agent...\n');

  const result = await runInvoiceOrchestrator({
    tenantId: TENANT_ID,
    purchaseOrderId: PO_ID,
    s3Bucket: 'nexusretail-dev-invoices-102268067799',
    s3Key: 'test-invoice.pdf',
  });

  console.log('=== Agent execution log ===');
  result.log.forEach((entry, i) => {
    console.log(`\nStep ${i + 1}: called "${entry.tool}"`);
    console.log('Input:', JSON.stringify(entry.input));
    console.log('Output:', JSON.stringify(entry.output, null, 2));
  });

  console.log('\n=== Final summary from agent ===');
  console.log(result.summary);
}

main().catch((err) => {
  console.error('Orchestrator run failed:', err);
  process.exit(1);
});