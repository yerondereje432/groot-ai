/**
 * GeminiOcrParser — OCR fallback for scanned textbook PDFs.
 *
 * Per spec §16 step 2: "OCR fallback for scanned pages." This was previously
 * deferred (see ASSUMPTIONS.md A-series) because a from-scratch OCR pipeline
 * (page rasterization + Tesseract + a Ge'ez-trained model) is a heavy lift.
 *
 * Instead of standing up a separate OCR service, this sends the PDF's raw
 * bytes directly to Gemini as inline file data — Gemini reads PDF pages as
 * images natively, which means it can transcribe scanned pages (including
 * Amharic/Ge'ez script, which most conventional OCR engines handle poorly
 * without a fine-tuned model) without any page-to-image conversion step or
 * extra native dependencies (no canvas/poppler needed in this environment).
 *
 * `AdvancedPdfParser` remains the first choice for text-layer PDFs — it's
 * free, fast, and deterministic. This class is only invoked by `PdfParser`
 * when text-layer extraction looks too sparse to be real (see
 * `looksLikeScannedDocument` in index.ts), and only when a Gemini API key is
 * configured. Per spec ASSUMPTIONS.md this is a reasonable interim strategy
 * pending a dedicated Ge'ez-tuned OCR model, and is documented as such below.
 */
import { ParsedDocument } from './index.js';
export interface GeminiOcrOptions {
    apiKey: string;
    model?: string;
}
export declare class GeminiOcrParser {
    private readonly apiKey;
    private readonly model;
    private readonly baseUrl;
    constructor(options: GeminiOcrOptions);
    parse(filename: string, content: Buffer): Promise<ParsedDocument>;
}
/**
 * Heuristic: does this text-layer extraction look like it actually came from
 * a scanned (image-only) page rather than a real text layer?
 *
 * pdf-parse returns *something* even for scanned PDFs sometimes (stray
 * artifacts, watermarks), so we check density (chars per page) rather than
 * just "is it empty".
 */
export declare function looksLikeScannedDocument(extractedText: string, pageCount: number): boolean;
//# sourceMappingURL=gemini-ocr.d.ts.map