import fs from 'fs';
import path from 'path';
import type { ExtractedInvoice } from './extractInvoice';

// TEXTRACT_MODE=mock: stands in for a real AnalyzeExpense call so the app
// runs (and the invoice-matching demo works) without any AWS account.
// Keyed by the uploaded file's sha256, not its name or an upload param, so
// it goes through exactly the same duplicate-detection path a real invoice
// would (see the fileHash check in index.ts) and can't be pointed at an
// arbitrary fixture by an untrusted filename.
const SAMPLES_DIR = path.join(__dirname, '../../../samples');

let manifest: Record<string, string> | null = null;
function loadManifest(): Record<string, string> {
  if (!manifest) {
    manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'manifest.json'), 'utf8')) as Record<string, string>;
  }
  return manifest;
}

export function mockExtractInvoice(fileHash: string): ExtractedInvoice {
  const fixtureName = loadManifest()[fileHash];
  if (!fixtureName) {
    throw new Error(
      `TEXTRACT_MODE=mock only recognizes the sample invoices in samples/ (see samples/README.md) — this file's hash isn't one of them.`
    );
  }
  const raw = fs.readFileSync(path.join(SAMPLES_DIR, fixtureName), 'utf8');
  return JSON.parse(raw) as ExtractedInvoice;
}
