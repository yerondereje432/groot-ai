import { describe, it, expect } from 'vitest';
import { classifyIntent } from './index.js';
describe('classifyIntent', () => {
    it.each([
        ['Explain federalism in simple terms', 'explain'],
        ['What is photosynthesis?', 'explain'],
        ['How does electrolysis work?', 'explain'],
        ['Why does voltage drop in a series circuit?', 'explain'],
        ['Define mitosis', 'explain'],
        ['Summarize the French Revolution', 'explain'],
    ])('classifies "%s" as "%s"', (query, expected) => {
        expect(classifyIntent(query)).toBe(expected);
    });
    it.each([
        ['Give me 10 MCQs on energy changes', 'generate_questions'],
        ['Create 5 practice questions on the digestive system', 'generate_questions'],
        ['Test me on atomic structure', 'generate_questions'],
        ['Make some problems about quadratic equations', 'generate_questions'],
    ])('classifies "%s" as "%s"', (query, expected) => {
        expect(classifyIntent(query)).toBe(expected);
    });
    it.each([
        ['Give me a mock exam on biology', 'mock_exam'],
        ['Full exam paper for grade 10 chemistry', 'mock_exam'],
    ])('classifies "%s" as "%s"', (query, expected) => {
        expect(classifyIntent(query)).toBe(expected);
    });
    it('falls back to general when no pattern matches', () => {
        expect(classifyIntent('hi')).toBe('general');
        expect(classifyIntent('ሰላም')).toBe('general');
    });
});
//# sourceMappingURL=intent.test.js.map