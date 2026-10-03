/**
 * Ad-hoc validation tool: run the real (non-OCR) parsing path against an
 * actual PDF and report extraction density + section detection quality.
 *
 * This exists because ASSUMPTIONS.md §F1 previously said the OCR fallback
 * was "untested against real scanned Ethiopian MoE textbook pages — no
 * sample scans were available at build time." This repo does contain one
 * real textbook (`Books/G10-History-STB-2023-web.pdf`) — this script
 * actually runs the ingestion parser against it instead of leaving that
 * claim unverified. See docs/ingestion.md "Validated against a real
 * textbook" for the recorded results.
 *
 * Usage: npx tsx scripts/validate-pdf.ts <path-to-pdf>
 */
import { readFile } from 'node:fs/promises';
import { AdvancedPdfParser } from '../src/parse/advanced-pdf.js';
import { looksLikeScannedDocument } from '../src/parse/gemini-ocr.js';

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npx tsx scripts/validate-pdf.ts <path-to-pdf>');
    process.exit(1);
  }
  const buf = await readFile(path);
  const parser = new AdvancedPdfParser();
  const { text, numpages } = await parser.extractRaw(buf);
  const charCount = text.replace(/\s+/g, '').length;
  const density = charCount / numpages;
  const scanned = looksLikeScannedDocument(text, numpages);

  console.log(`File: ${path}`);
  console.log(`Pages: ${numpages}`);
  console.log(`Total extracted chars (whitespace-stripped): ${charCount}`);
  console.log(`Density (chars/page): ${density.toFixed(1)}`);
  console.log(`looksLikeScannedDocument() → ${scanned} (threshold: <40 chars/page)`);

  const parsed = parser.parseFromExtraction(path, text, numpages);
  console.log(`\nSections detected: ${parsed.sections.length}`);
  console.log(`Detected language: ${parsed.language}`);

  const withHeading = parsed.sections.filter(s => s.heading !== null).length;
  console.log(`Sections with a detected heading: ${withHeading}/${parsed.sections.length}`);

  console.log(`\n--- First 5 sections ---`);
  for (const s of parsed.sections.slice(0, 5)) {
    console.log(`[heading=${JSON.stringify(s.heading)}] page=${s.page} bodyLen=${s.body.length}`);
    console.log(`  "${s.body.slice(0, 120).replace(/\n/g, ' ')}..."`);
  }

  const tiny = parsed.sections.filter(s => s.body.length < 50).length;
  console.log(`\nSections under 50 chars (likely noise/fragments): ${tiny}/${parsed.sections.length}`);

  const pages = parsed.sections.map(s => s.page ?? 0);
  let nonMonotonic = 0;
  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1] ?? 0;
    const cur = pages[i] ?? 0;
    if (cur < prev) nonMonotonic++;
  }
  console.log(`\nPage attribution range: ${Math.min(...pages)}-${Math.max(...pages)} (document has ${numpages} pages)`);
  console.log(`Non-monotonic page transitions (should be 0 for a linear book): ${nonMonotonic}/${pages.length - 1}`);
  console.log(`Last 10 section pages: ${pages.slice(-10).join(', ')}`);
}

main().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
