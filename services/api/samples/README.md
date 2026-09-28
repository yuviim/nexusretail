# Sample invoices (TEXTRACT_MODE=mock)

Three fake invoice PDFs, each demonstrating one of the three outcomes the
matcher can produce, paired with the sample purchase orders
`prisma/seed.ts` creates on the Northwind tenant.

| File | Against PO | Outcome | Why |
|---|---|---|---|
| `clean-match.pdf` | `PO-1001` | matched | Qty and unit price both agree with the PO exactly. |
| `price-mismatch.pdf` | `PO-1002` | flagged | Same quantity as the PO, but unit price is 3.50 instead of the PO's 3.20. |
| `extra-line-item.pdf` | `PO-1003` | flagged | The PO line (vanilla syrup) matches exactly, but the invoice bills an extra napkins line the PO never ordered. |

## How the mock works

With `TEXTRACT_MODE=mock`, uploading one of these three PDFs through
`POST /invoices/upload` skips the real Textract call. `manifest.json` maps
each file's sha256 hash to a fixture JSON (`clean-match.json`, etc.) shaped
exactly like `extractInvoice`'s real return value — see
`src/agents/tools/mockExtractInvoice.ts`. Uploading any other file in mock
mode returns a 422 telling you it isn't one of the three known samples,
rather than silently returning made-up data.

Regenerating a sample PDF changes its hash, which breaks the manifest
mapping — if you edit one, recompute its hash (`sha256sum
clean-match.pdf`) and update `manifest.json` to match.
