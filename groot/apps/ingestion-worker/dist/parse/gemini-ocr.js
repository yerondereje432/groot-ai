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
import { detectLanguage } from './index.js';
export class GeminiOcrParser {
    constructor(options) {
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.apiKey = options.apiKey;
        this.model = options.model || 'gemini-1.5-flash';
    }
    async parse(filename, content) {
        const base64 = content.toString('base64');
        const prompt = `This PDF is a scanned page from an Ethiopian high-school textbook. It may be in ` +
            `Amharic (Ge'ez script) or English. Transcribe the text faithfully, preserving the ` +
            `original language exactly as written (do not translate). Split the transcription into ` +
            `sections by chapter/unit/topic heading where visible. Respond with ONLY a JSON array, ` +
            `no prose, no markdown fences, in this exact shape:\n` +
            `[{"heading": "<heading text or null>", "body": "<transcribed paragraph text>", "page": <1-based page number>}]\n` +
            `Skip page numbers, running headers/footers, and any illegible fragments rather than guessing.`;
        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { inline_data: { mime_type: 'application/pdf', data: base64 } },
                            { text: prompt },
                        ],
                    },
                ],
                generationConfig: { temperature: 0, maxOutputTokens: 8192 },
            }),
        });
        if (!response.ok) {
            throw new Error(`Gemini OCR error: ${response.statusText}`);
        }
        const data = (await response.json());
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('GeminiOcrParser: no JSON array found in OCR response');
        }
        const rawSections = JSON.parse(jsonMatch[0]);
        const sections = rawSections
            .filter(s => typeof s.body === 'string' && s.body.trim().length > 10)
            .map(s => ({
            heading: s.heading ?? null,
            body: s.body.trim(),
            page: typeof s.page === 'number' ? s.page : undefined,
        }));
        const fullText = sections.map(s => s.body).join('\n');
        return {
            title: filename.replace(/\.pdf$/i, ''),
            sourceRef: filename,
            sections,
            language: detectLanguage(fullText),
        };
    }
}
/**
 * Heuristic: does this text-layer extraction look like it actually came from
 * a scanned (image-only) page rather than a real text layer?
 *
 * pdf-parse returns *something* even for scanned PDFs sometimes (stray
 * artifacts, watermarks), so we check density (chars per page) rather than
 * just "is it empty".
 */
export function looksLikeScannedDocument(extractedText, pageCount) {
    if (pageCount <= 0)
        return false;
    const density = extractedText.replace(/\s+/g, '').length / pageCount;
    return density < 40; // fewer than ~40 real characters per page is not a real text layer
}
//# sourceMappingURL=gemini-ocr.js.map