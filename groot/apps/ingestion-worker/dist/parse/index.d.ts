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
export declare class MarkdownParser implements Parser {
    accepts(filename: string): boolean;
    parse(filename: string, content: Buffer | string): Promise<ParsedDocument>;
}
export declare class PlainTextParser implements Parser {
    accepts(filename: string): boolean;
    parse(filename: string, content: Buffer | string): Promise<ParsedDocument>;
}
export interface ParseOptions {
    /**
     * When set, PdfParser falls back to Gemini-vision OCR for PDFs whose
     * text-layer extraction looks too sparse to be real (scanned pages).
     * Per spec §16 step 2 ("OCR fallback for scanned pages") — see
     * gemini-ocr.ts for why this uses Gemini instead of a Tesseract pipeline.
     */
    geminiApiKey?: string;
}
export declare class PdfParser implements Parser {
    private readonly options;
    constructor(options?: ParseOptions);
    accepts(filename: string): boolean;
    parse(filename: string, content: Buffer | string): Promise<ParsedDocument>;
}
export declare function parseDocument(filename: string, content: Buffer | string, options?: ParseOptions): Promise<ParsedDocument>;
/**
 * Lightweight language detector — looks for Ge'ez Unicode range (U+1200–U+137F).
 * Real systems would use a proper detector (e.g., cld3); this is enough for routing
 * curriculum content into the correct language pipeline (§7).
 */
export declare function detectLanguage(text: string): 'am' | 'en';
//# sourceMappingURL=index.d.ts.map