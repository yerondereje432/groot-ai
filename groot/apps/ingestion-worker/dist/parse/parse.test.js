import { describe, it, expect } from 'vitest';
import { MarkdownParser, PlainTextParser, parseDocument, detectLanguage } from './index.js';
describe('detectLanguage', () => {
    it('detects Ge\'ez-heavy text as Amharic', () => {
        expect(detectLanguage('ፎቶሲንተዲስ ሂደት ነው። በእጽባት ውስጥ ይከናወናል።')).toBe('am');
    });
    it('detects Latin-heavy text as English', () => {
        expect(detectLanguage('Photosynthesis is a process. It happens in plants.')).toBe('en');
    });
});
describe('MarkdownParser', () => {
    it('parses headings and body', async () => {
        const md = `# Title

## Section A
First paragraph here.

## Section B
Second paragraph here.
`;
        const p = new MarkdownParser();
        const doc = await p.parse('test.md', md);
        expect(doc.title).toBe('Title');
        expect(doc.sections.length).toBeGreaterThanOrEqual(2);
        expect(doc.sections.some(s => s.heading === 'Section A')).toBe(true);
        expect(doc.sections.find(s => s.heading === 'Section A')?.body).toContain('First paragraph');
    });
    it('parses via parseDocument dispatch', async () => {
        const doc = await parseDocument('test.md', '# Hello\n\nBody text.');
        expect(doc.title).toBe('Hello');
    });
});
describe('PlainTextParser', () => {
    it('splits on double newlines', async () => {
        const txt = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
        const p = new PlainTextParser();
        const doc = await p.parse('test.txt', txt);
        expect(doc.sections).toHaveLength(3);
        expect(doc.sections[0]?.body).toBe('First paragraph.');
    });
});
//# sourceMappingURL=parse.test.js.map