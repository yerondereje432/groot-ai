import { ParsedDocument } from './index.js';
/**
 * AdvancedPdfParser
 *
 * Uses a heuristic-based approach to identify headers and sections in textbooks.
 * Handles:
 * 1. Form feeds for page separation.
 * 2. Regex-based header detection (e.g., "Chapter X", "1.1 Section").
 * 3. Whitespace normalization and noise removal (page numbers, footers).
 */
export declare class AdvancedPdfParser {
    parse(filename: string, content: Buffer): Promise<ParsedDocument>;
    /** Exposed separately so callers can inspect text density before deciding on OCR fallback. */
    extractRaw(content: Buffer): Promise<{
        text: string;
        numpages: number;
    }>;
    parseFromExtraction(filename: string, text: string, numpages: number): ParsedDocument;
}
//# sourceMappingURL=advanced-pdf.d.ts.map