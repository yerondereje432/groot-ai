/**
 * Curriculum text extraction.
 *
 * Per spec §16 step 2: text + structure extraction; OCR fallback for scanned pages;
 * preserve equations/tables.
 *
 * MVP implementation supports plain text and Markdown. PDF support uses `pdf-parse`
 * which handles text-layer PDFs well. Scanned/image PDFs require OCR — that is
 * deferred (see ASSUMPTIONS.md and §38 future features).
 */

export interface ParsedSection {
  /** Section heading or null for body-only chunks. */
  heading: string | null;
  /** Plain text body, normalized. */
  body: string;
  /** 1-based page or section number for citation. */
  page?: number;
}

export interface ParsedDocument {
  title: string;
  sourceRef: string;
  sections: ParsedSection[];
  /** Detected language. */
  language: 'am' | 'en';
}

export interface Parser {
  /** Returns true if this parser can handle the given file. */
  accepts(filename: string): boolean;
  parse(filename: string, content: Buffer | string): Promise<ParsedDocument>;
}

export class MarkdownParser implements Parser {
  accepts(filename: string): boolean {
    return filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown');
  }

  async parse(filename: string, content: Buffer | string): Promise<ParsedDocument> {
    const text = typeof content === 'string' ? content : content.toString('utf8');
    const lines = text.split(/\r?\n/);

    let title = filename.replace(/\.(md|markdown)$/i, '');
    const sections: ParsedSection[] = [];
    let current: ParsedSection = { heading: null, body: '' };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (current.body.trim() || current.heading) sections.push(current);
        current = { heading: headingMatch[2]?.trim() ?? null, body: '' };
        // First H1 becomes the document title.
        if (headingMatch[1] === '#' && !sections.length) {
          title = headingMatch[2]?.trim() ?? title;
        }
      } else {
        current.body += line + '\n';
      }
    }
    if (current.body.trim() || current.heading) sections.push(current);

    // Normalize whitespace in body.
    for (const s of sections) s.body = s.body.replace(/\n{3,}/g, '\n\n').trim();

    return {
      title,
      sourceRef: filename,
      sections,
      language: detectLanguage(text),
    };
  }
}

export class PlainTextParser implements Parser {
  accepts(filename: string): boolean {
    return filename.toLowerCase().endsWith('.txt');
  }

  async parse(filename: string, content: Buffer | string): Promise<ParsedDocument> {
    const text = typeof content === 'string' ? content : content.toString('utf8');
    // Heuristic: split on double newlines into sections.
    const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    return {
      title: filename.replace(/\.txt$/i, ''),
      sourceRef: filename,
      sections: paras.map(p => ({ heading: null, body: p })),
      language: detectLanguage(text),
    };
  }
}

import { AdvancedPdfParser } from './advanced-pdf.js';
import { GeminiOcrParser, looksLikeScannedDocument } from './gemini-ocr.js';

export interface ParseOptions {
  /**
   * When set, PdfParser falls back to Gemini-vision OCR for PDFs whose
   * text-layer extraction looks too sparse to be real (scanned pages).
   * Per spec §16 step 2 ("OCR fallback for scanned pages") — see
   * gemini-ocr.ts for why this uses Gemini instead of a Tesseract pipeline.
   */
  geminiApiKey?: string;
}

export class PdfParser implements Parser {
  constructor(private readonly options: ParseOptions = {}) {}

  accepts(filename: string): boolean {
    return filename.toLowerCase().endsWith('.pdf');
  }

  async parse(filename: string, content: Buffer | string): Promise<ParsedDocument> {
    if (typeof content === 'string') {
      throw new Error('PdfParser requires binary buffer content');
    }
    const advancedParser = new AdvancedPdfParser();
    const { text, numpages } = await advancedParser.extractRaw(content);

    if (looksLikeScannedDocument(text, numpages) && this.options.geminiApiKey) {
      try {
        const ocr = new GeminiOcrParser({ apiKey: this.options.geminiApiKey });
        return await ocr.parse(filename, content);
      } catch {
        // OCR failed (network, quota, malformed response) — fall back to whatever
        // text-layer extraction we did get rather than failing the whole ingest job.
        return advancedParser.parseFromExtraction(filename, text, numpages);
      }
    }

    return advancedParser.parseFromExtraction(filename, text, numpages);
  }
}

export async function parseDocument(
  filename: string,
  content: Buffer | string,
  options: ParseOptions = {},
): Promise<ParsedDocument> {
  const parsers: Parser[] = [new MarkdownParser(), new PlainTextParser(), new PdfParser(options)];
  for (const p of parsers) {
    if (p.accepts(filename)) return p.parse(filename, content);
  }
  throw new Error(`No parser for file: ${filename}`);
}

/**
 * Lightweight language detector — looks for Ge'ez Unicode range (U+1200–U+137F).
 * Real systems would use a proper detector (e.g., cld3); this is enough for routing
 * curriculum content into the correct language pipeline (§7).
 */
export function detectLanguage(text: string): 'am' | 'en' {
  const sample = text.slice(0, 2000);
  let geez = 0;
  let latin = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x1200 && code <= 0x137f) geez++;
    if (code >= 0x41 && code <= 0x7a) latin++;
  }
  return geez > latin * 0.1 ? 'am' : 'en';
}
