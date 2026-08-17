import { detectLanguage } from './index.js';
/**
 * AdvancedPdfParser
 *
 * Uses a heuristic-based approach to identify headers and sections in textbooks.
 * Handles:
 * 1. Form feeds for page separation.
 * 2. Regex-based header detection (e.g., "Chapter X", "1.1 Section").
 * 3. Whitespace normalization and noise removal (page numbers, footers).
 */
export class AdvancedPdfParser {
    async parse(filename, content) {
        const pdfParse = (await import('pdf-parse')).default;
        const result = await pdfParse(content);
        return this.parseFromExtraction(filename, result.text, result.numpages);
    }
    /** Exposed separately so callers can inspect text density before deciding on OCR fallback. */
    async extractRaw(content) {
        const pdfParse = (await import('pdf-parse')).default;
        const result = await pdfParse(content);
        return { text: result.text, numpages: result.numpages };
    }
    parseFromExtraction(filename, text, numpages) {
        // 1. Split into pages using form feed
        const rawPages = text.split(/\f/);
        const sections = [];
        let currentHeading = null;
        let currentBody = [];
        // Common textbook header patterns
        const headerPatterns = [
            /^CHAPTER\s+\d+/i,
            /^UNIT\s+\d+/i,
            /^\d+\.\d+\s+[A-Z]/, // e.g. 1.2 Introduction
            /^[A-Z][a-z]+\s+\d+\.\d+/, // e.g. Introduction 1.2
        ];
        for (let i = 0; i < rawPages.length; i++) {
            const pageText = rawPages[i] || '';
            const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
            for (const line of lines) {
                // Skip common noise (page numbers at start/end of page)
                if (/^\d+$/.test(line) || /^Page\s+\d+$/i.test(line))
                    continue;
                const isHeader = headerPatterns.some(p => p.test(line));
                if (isHeader) {
                    // Save previous section
                    if (currentBody.length > 0) {
                        sections.push({
                            heading: currentHeading,
                            body: currentBody.join('\n').trim(),
                            page: i + 1
                        });
                        currentBody = [];
                    }
                    currentHeading = line;
                }
                else {
                    currentBody.push(line);
                }
            }
        }
        // Push final section
        if (currentBody.length > 0) {
            sections.push({
                heading: currentHeading,
                body: currentBody.join('\n').trim(),
                page: rawPages.length
            });
        }
        return {
            title: filename.replace(/\.pdf$/i, ''),
            sourceRef: filename,
            sections: sections.filter(s => s.body.length > 10), // filter out tiny artifacts
            language: detectLanguage(text),
        };
    }
}
//# sourceMappingURL=advanced-pdf.js.map