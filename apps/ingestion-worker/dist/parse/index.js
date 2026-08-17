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
export class MarkdownParser {
    accepts(filename) {
        return filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown');
    }
    async parse(filename, content) {
        const text = typeof content === 'string' ? content : content.toString('utf8');
        const lines = text.split(/\r?\n/);
        let title = filename.replace(/\.(md|markdown)$/i, '');
        const sections = [];
        let current = { heading: null, body: '' };
        for (const line of lines) {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                if (current.body.trim() || current.heading)
                    sections.push(current);
                current = { heading: headingMatch[2]?.trim() ?? null, body: '' };
                // First H1 becomes the document title.
                if (headingMatch[1] === '#' && !sections.length) {
                    title = headingMatch[2]?.trim() ?? title;
                }
            }
            else {
                current.body += line + '\n';
            }
        }
        if (current.body.trim() || current.heading)
            sections.push(current);
        // Normalize whitespace in body.
        for (const s of sections)
            s.body = s.body.replace(/\n{3,}/g, '\n\n').trim();
        return {
            title,
            sourceRef: filename,
            sections,
            language: detectLanguage(text),
        };
    }
}
export class PlainTextParser {
    accepts(filename) {
        return filename.toLowerCase().endsWith('.txt');
    }
    async parse(filename, content) {
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
export class PdfParser {
    constructor(options = {}) {
        this.options = options;
    }
    accepts(filename) {
        return filename.toLowerCase().endsWith('.pdf');
    }
    async parse(filename, content) {
        if (typeof content === 'string') {
            throw new Error('PdfParser requires binary buffer content');
        }
        const advancedParser = new AdvancedPdfParser();
        const { text, numpages } = await advancedParser.extractRaw(content);
        if (looksLikeScannedDocument(text, numpages) && this.options.geminiApiKey) {
            try {
                const ocr = new GeminiOcrParser({ apiKey: this.options.geminiApiKey });
                return await ocr.parse(filename, content);
            }
            catch {
                // OCR failed (network, quota, malformed response) — fall back to whatever
                // text-layer extraction we did get rather than failing the whole ingest job.
                return advancedParser.parseFromExtraction(filename, text, numpages);
            }
        }
        return advancedParser.parseFromExtraction(filename, text, numpages);
    }
}
export async function parseDocument(filename, content, options = {}) {
    const parsers = [new MarkdownParser(), new PlainTextParser(), new PdfParser(options)];
    for (const p of parsers) {
        if (p.accepts(filename))
            return p.parse(filename, content);
    }
    throw new Error(`No parser for file: ${filename}`);
}
/**
 * Lightweight language detector — looks for Ge'ez Unicode range (U+1200–U+137F).
 * Real systems would use a proper detector (e.g., cld3); this is enough for routing
 * curriculum content into the correct language pipeline (§7).
 */
export function detectLanguage(text) {
    const sample = text.slice(0, 2000);
    let geez = 0;
    let latin = 0;
    for (const ch of sample) {
        const code = ch.codePointAt(0) ?? 0;
        if (code >= 0x1200 && code <= 0x137f)
            geez++;
        if (code >= 0x41 && code <= 0x7a)
            latin++;
    }
    return geez > latin * 0.1 ? 'am' : 'en';
}
//# sourceMappingURL=index.js.map