import { describe, it, expect } from 'vitest';
import { AdvancedPdfParser } from './advanced-pdf.js';

describe('AdvancedPdfParser.parseFromExtraction', () => {
  it('attributes sections to the correct page using form-feed page breaks', () => {
    const p = new AdvancedPdfParser();
    const text = [
      'CHAPTER 1\nIntro paragraph on page one.',
      'More text continuing chapter one on page two.',
      'CHAPTER 2\nContent of chapter two starts on page three.',
    ].join('\f');

    const doc = p.parseFromExtraction('book.pdf', text, 3);

    expect(doc.sections.length).toBeGreaterThanOrEqual(2);
    const ch1 = doc.sections.find(s => s.heading === 'CHAPTER 1');
    const ch2 = doc.sections.find(s => s.heading === 'CHAPTER 2');
    expect(ch1).toBeDefined();
    expect(ch2).toBeDefined();
    expect(ch1?.page).toBe(1);
    expect(ch2?.page).toBe(3);
    // Page numbers must be increasing, not all collapsed onto a single page
    // (regression test: pdf-parse's default output never contains a form
    // feed, so splitting on `\f` used to silently produce exactly one
    // "page" for the entire document).
    expect(ch2?.page ?? 0).toBeGreaterThan(ch1?.page ?? 0);
  });

  it('filters out running headers/footers that repeat across most pages instead of treating them as new chapter headings', () => {
    const p = new AdvancedPdfParser();
    const runningHeader = 'UNIT 1';
    const pages = [
      `${runningHeader}\nFirst real sentence of content.`,
      `${runningHeader}\nSecond real sentence, still part of the same unit.`,
      `${runningHeader}\nThird real sentence, still the same unit.`,
      `${runningHeader}\nFourth real sentence, still the same unit.`,
      `${runningHeader}\nFifth real sentence, still the same unit.`,
    ];
    const text = pages.join('\f');

    const doc = p.parseFromExtraction('book.pdf', text, pages.length);

    // Without running-header filtering this would produce 5 separate
    // one-line "UNIT 1" sections, fragmenting what is really one
    // continuous unit of content.
    const headerSections = doc.sections.filter(s => s.heading === runningHeader);
    expect(headerSections.length).toBeLessThanOrEqual(1);
    const combinedBody = doc.sections.map(s => s.body).join(' ');
    expect(combinedBody).toContain('First real sentence');
    expect(combinedBody).toContain('Fifth real sentence');
  });

  it('still detects a genuine one-off chapter heading that does not repeat', () => {
    const p = new AdvancedPdfParser();
    const text = ['CHAPTER 1\nSome content.', 'More content, no heading here.'].join('\f');

    const doc = p.parseFromExtraction('book.pdf', text, 2);
    expect(doc.sections.some(s => s.heading === 'CHAPTER 1')).toBe(true);
  });

  it('strips plain page-number lines', () => {
    const p = new AdvancedPdfParser();
    const text = ['CHAPTER 1\nContent here.\n42'].join('\f');
    const doc = p.parseFromExtraction('book.pdf', text, 1);
    expect(doc.sections[0]?.body).not.toContain('42');
  });
});
