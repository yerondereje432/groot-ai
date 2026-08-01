import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiOcrParser, looksLikeScannedDocument } from './gemini-ocr.js';
describe('looksLikeScannedDocument', () => {
    it('flags near-empty extraction on a multi-page doc as scanned', () => {
        expect(looksLikeScannedDocument('   \n\n  12  \n', 10)).toBe(true);
    });
    it('does not flag a normal text-layer extraction as scanned', () => {
        const text = 'Chapter 1: Introduction\n'.repeat(50) + 'Real body text with substantial content. '.repeat(100);
        expect(looksLikeScannedDocument(text, 5)).toBe(false);
    });
    it('treats zero pages as not scanned (avoid div-by-zero false positive)', () => {
        expect(looksLikeScannedDocument('', 0)).toBe(false);
    });
});
describe('GeminiOcrParser', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });
    it('parses OCR JSON response into sections with detected language', async () => {
        const ocrJson = JSON.stringify([
            { heading: 'ምዕራፍ አንድ', body: 'ይህ የአማርኛ ጽሑፍ ነው። '.repeat(5), page: 1 },
            { heading: null, body: 'more body text here that is long enough to survive filtering', page: 2 },
        ]);
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK',
            json: async () => ({ candidates: [{ content: { parts: [{ text: ocrJson }] } }] }),
        });
        const parser = new GeminiOcrParser({ apiKey: 'test-key' });
        const doc = await parser.parse('scanned.pdf', Buffer.from('%PDF-1.4 fake'));
        expect(doc.sections).toHaveLength(2);
        expect(doc.sections[0]?.heading).toBe('ምዕራፍ አንድ');
        expect(doc.language).toBe('am');
        expect(doc.sourceRef).toBe('scanned.pdf');
    });
    it('filters out tiny/illegible fragments', async () => {
        const ocrJson = JSON.stringify([
            { heading: null, body: 'x', page: 1 },
            { heading: 'Real Section', body: 'a properly transcribed paragraph of real length', page: 1 },
        ]);
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK',
            json: async () => ({ candidates: [{ content: { parts: [{ text: ocrJson }] } }] }),
        });
        const parser = new GeminiOcrParser({ apiKey: 'test-key' });
        const doc = await parser.parse('scanned.pdf', Buffer.from('%PDF-1.4 fake'));
        expect(doc.sections).toHaveLength(1);
        expect(doc.sections[0]?.heading).toBe('Real Section');
    });
    it('throws when the API response has no parseable JSON array', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK',
            json: async () => ({ candidates: [{ content: { parts: [{ text: 'I cannot read this scan.' }] } }] }),
        });
        const parser = new GeminiOcrParser({ apiKey: 'test-key' });
        await expect(parser.parse('scanned.pdf', Buffer.from('%PDF-1.4 fake'))).rejects.toThrow();
    });
    it('throws on a non-ok HTTP response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Service Unavailable' });
        const parser = new GeminiOcrParser({ apiKey: 'test-key' });
        await expect(parser.parse('scanned.pdf', Buffer.from('%PDF-1.4 fake'))).rejects.toThrow();
    });
});
//# sourceMappingURL=gemini-ocr.test.js.map