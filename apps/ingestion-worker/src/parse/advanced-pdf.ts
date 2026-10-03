import { ParsedDocument, ParsedSection, detectLanguage } from './index.js';

const PAGE_BREAK = '\f';

/**
 * Replicates pdf-parse's own default `render_page` text-reconstruction
 * logic (see node_modules/pdf-parse/lib/pdf-parse.js) but appends an
 * explicit form-feed page-boundary marker.
 *
 * This matters because pdf-parse's ACTUAL default behavior joins pages with
 * a plain `"\n\n"`, never a form feed — confirmed by reading its source.
 * This parser's page-splitting (`text.split(/\f/)`, below) silently assumed
 * form-feed-delimited pages and would previously treat the ENTIRE document
 * as a single "page" for any real-world PDF, since pdf-parse never emits
 * one. That's not a hypothetical: validating against the real textbook
 * checked into this repo (`Books/G10-History-STB-2023-web.pdf`, 246 pages)
 * showed exactly this — every extracted chunk's `page` ended up wrong,
 * which breaks the "cite the source page" feature this product depends on
 * for trust (docs/ingestion.md `source_ref`). Passing a custom `pagerender`
 * to pdf-parse is the supported way to control this.
 */
function renderPageWithBreak(pageData: {
  getTextContent: (opts: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
    items: Array<{ str: string; transform: number[] }>;
  }>;
}): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then(textContent => {
      let lastY: number | undefined;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      return text + PAGE_BREAK;
    });
}

/**
 * AdvancedPdfParser
 * 
 * Uses a heuristic-based approach to identify headers and sections in textbooks.
 * Handles:
 * 1. Form feeds for page separation (via a custom `pagerender`, see above).
 * 2. Regex-based header detection (e.g., "Chapter X", "1.1 Section").
 * 3. Whitespace normalization and noise removal (page numbers, footers,
 *    and running headers that repeat across most pages).
 */
export class AdvancedPdfParser {
  async parse(filename: string, content: Buffer): Promise<ParsedDocument> {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(content, { pagerender: renderPageWithBreak });
    return this.parseFromExtraction(filename, result.text, result.numpages);
  }

  /** Exposed separately so callers can inspect text density before deciding on OCR fallback. */
  async extractRaw(content: Buffer): Promise<{ text: string; numpages: number }> {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(content, { pagerender: renderPageWithBreak });
    return { text: result.text, numpages: result.numpages };
  }

  parseFromExtraction(filename: string, text: string, numpages: number): ParsedDocument {
    // 1. Split into pages using form feed (see renderPageWithBreak above —
    // this ONLY works because we inject our own page-boundary marker; the
    // pdf-parse library's own default output has no \f in it at all).
    const rawPages = text.split(/\f/);

    // 1b. Detect running headers/footers — text that repeats verbatim
    // across many pages (a chapter/unit title printed in the header of
    // every page, "© Ministry of Education 2023" footers, etc.). Validated
    // against the real Grade-10 History textbook in Books/: without this,
    // a running header like "Unit 1 | Development of Capitalism..." gets
    // misdetected as a NEW chapter heading on every single page it recurs,
    // shattering what should be one coherent section into dozens of
    // fragments. A line that appears on a large fraction of pages is
    // structural page furniture, not real heading content, regardless of
    // whether it happens to match a heading-shaped regex.
    const pageLineSets = rawPages.map(p =>
      new Set(p.split('\n').map(l => l.trim()).filter(Boolean)),
    );
    const lineOccurrences = new Map<string, number>();
    for (const lineSet of pageLineSets) {
      for (const line of lineSet) {
        lineOccurrences.set(line, (lineOccurrences.get(line) ?? 0) + 1);
      }
    }
    // A textbook's running header usually changes per chapter/unit, so it
    // only recurs across THAT chapter's page range, not 25%+ of the whole
    // book — requiring a high fraction of total pages (as a first version
    // of this heuristic did) badly under-detects. An absolute count is more
    // robust: the same line appearing verbatim 5+ times is essentially
    // never a coincidence in running body text, it's page furniture. Short
    // documents get a proportional floor instead so a 6-page document
    // doesn't need its header to repeat 5 times to be caught.
    const repeatedLineThreshold = rawPages.length < 20 ? Math.max(2, Math.ceil(rawPages.length * 0.3)) : 5;
    const runningHeaderFooters = new Set(
      [...lineOccurrences.entries()]
        .filter(([, count]) => count >= repeatedLineThreshold)
        .map(([line]) => line),
    );

    const sections: ParsedSection[] = [];
    let currentHeading: string | null = null;
    // Page where `currentHeading` (or, for the first/headingless section,
    // the first body line) was found — i.e. where the section STARTS.
    //
    // Previously this tracked the page where the section ENDED (the page
    // of whichever heading closed it out, or the document's last page for
    // the final section), which is backwards for citation purposes: a
    // chapter spanning pages 5-20 was being attributed to page 20, not
    // page 5, so "see page N" citations pointed at the wrong end of the
    // section. Caught while validating page attribution against the real
    // textbook in Books/.
    let currentStartPage = 1;
    let currentBody: string[] = [];

    // Common textbook header patterns
    const headerPatterns = [
      /^CHAPTER\s+\d+/i,
      /^UNIT\s+\d+/i,
      /^\d+\.\d+\s+[A-Z]/, // e.g. 1.2 Introduction
      /^[A-Z][a-z]+\s+\d+\.\d+/, // e.g. Introduction 1.2
    ];

    // Table-of-contents entries ("2.6  Impacts of Colonial Rule .... 39")
    // use the same "N.N  Title" shape as a real section heading, so they
    // false-positive against headerPatterns above and get pulled in as a
    // bogus "heading" for whatever body text happens to follow the ToC
    // page. Found by validating against the real textbook in Books/,
    // where unit 2.6's actual heading never appears in the detected
    // sections — its ToC line shadowed it instead. Dot-leader lines (a run
    // of dots connecting a title to its page number) are a reliable,
    // format-independent signal that a line is front-matter, not content.
    const dotLeaderPattern = /\.{4,}\s*\d+\s*$/;

    for (let i = 0; i < rawPages.length; i++) {
      const pageText = rawPages[i] || '';
      const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        // Skip common noise: page numbers, running headers/footers that
        // repeat across most of the document, and table-of-contents lines.
        if (/^\d+$/.test(line) || /^Page\s+\d+$/i.test(line)) continue;
        if (runningHeaderFooters.has(line)) continue;
        if (dotLeaderPattern.test(line)) continue;

        const isHeader = headerPatterns.some(p => p.test(line));

        if (isHeader) {
          // Save previous section, attributed to the page it started on.
          if (currentBody.length > 0) {
            sections.push({
              heading: currentHeading,
              body: currentBody.join('\n').trim(),
              page: currentStartPage
            });
            currentBody = [];
          }
          currentHeading = line;
          currentStartPage = i + 1;
        } else {
          if (currentBody.length === 0) {
            currentStartPage = i + 1;
          }
          currentBody.push(line);
        }
      }
    }

    // Push final section
    if (currentBody.length > 0) {
      sections.push({
        heading: currentHeading,
        body: currentBody.join('\n').trim(),
        page: currentStartPage
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
