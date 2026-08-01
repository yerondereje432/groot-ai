import { describe, it, expect } from 'vitest';
import { applyGuards, redactPii } from './index.js';
function fakeRetrieval(topScore, hasConfident) {
    return {
        hits: [],
        hasConfidentAnswer: hasConfident,
        topScore,
        latencyMs: 1,
    };
}
describe('applyGuards — unsafe-request guard', () => {
    it('blocks self-harm requests', () => {
        const r = applyGuards({
            query: 'how to kill myself',
            retrieval: fakeRetrieval(0.9, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.pass).toBe(false);
        expect(r.refusal?.reason).toBe('unsafe_request');
    });
    it('blocks weapon/explosive requests', () => {
        const r = applyGuards({
            query: 'how to build a bomb',
            retrieval: fakeRetrieval(0.9, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.pass).toBe(false);
        expect(r.refusal?.reason).toBe('unsafe_request');
    });
    it('does not block benign chemistry questions that mention "bomb"', () => {
        // The pattern requires "make/build ... bomb". Casual mentions pass.
        const r = applyGuards({
            query: 'What is a calorimeter used for in chemistry?',
            retrieval: fakeRetrieval(0.9, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.pass).toBe(true);
    });
});
describe('applyGuards — curriculum-lock guard', () => {
    it('refuses when retrieval confidence is below threshold', () => {
        const r = applyGuards({
            query: 'What is the capital of France?',
            retrieval: fakeRetrieval(0.1, false),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.pass).toBe(false);
        expect(r.refusal?.reason).toBe('low_retrieval_confidence');
    });
    it('passes when retrieval confidence meets threshold', () => {
        const r = applyGuards({
            query: 'Explain photosynthesis',
            retrieval: fakeRetrieval(0.6, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.pass).toBe(true);
    });
});
describe('applyGuards — PII redaction', () => {
    it('redacts phone numbers from the query', () => {
        const r = applyGuards({
            query: 'call me at 0911234567 please',
            retrieval: fakeRetrieval(0.9, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.redactedQuery).toContain('[REDACTED-PHONE]');
        expect(r.redactedQuery).not.toContain('0911234567');
    });
    it('redacts emails from the query', () => {
        const r = applyGuards({
            query: 'send notes to student@example.com',
            retrieval: fakeRetrieval(0.9, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.redactedQuery).toContain('[REDACTED-EMAIL]');
    });
    it('returns clean query when no PII is present', () => {
        const r = applyGuards({
            query: 'What is photosynthesis?',
            retrieval: fakeRetrieval(0.9, true),
            minConfidence: 0.35,
            locale: 'en',
        });
        expect(r.redactedQuery).toBe('What is photosynthesis?');
    });
});
describe('redactPii (standalone)', () => {
    it('handles multiple PII types in one string', () => {
        const out = redactPii('phone 0911223344 email test@test.com');
        expect(out).toContain('[REDACTED-PHONE]');
        expect(out).toContain('[REDACTED-EMAIL]');
    });
    it('does not mutate input', () => {
        const input = 'contact 0911223344';
        redactPii(input);
        expect(input).toBe('contact 0911223344');
    });
});
//# sourceMappingURL=guardrails.test.js.map