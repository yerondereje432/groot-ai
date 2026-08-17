import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiReRanker } from './reranker.gemini.js';
import type { RetrievalHit } from '@groot/shared-types';

function makeHit(content: string, topicId: string, score: number): RetrievalHit {
  return {
    chunk: {
      id: `chunk-${Math.random()}`,
      topicId,
      content,
      sourceRef: `src:${topicId}`,
      version: '2024.1',
      status: 'published',
      createdAt: '2024-01-01T00:00:00Z',
    },
    score,
  };
}

function mockGeminiResponse(scores: Array<{ index: number; score: number }>) {
  return {
    ok: true,
    statusText: 'OK',
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(scores) }] } }],
    }),
  };
}

describe('GeminiReRanker', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns at most topK results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockGeminiResponse([{ index: 0, score: 0.9 }, { index: 1, score: 0.1 }, { index: 2, score: 0.8 }]),
    ) as unknown as typeof fetch;

    const r = new GeminiReRanker({ apiKey: 'test-key' });
    const candidates = [
      makeHit('electrolysis of water produces hydrogen', 't1', 0.5),
      makeHit('history of ethiopia', 't2', 0.4),
      makeHit('electrolysis in industry', 't1', 0.6),
    ];
    const out = await r.rerank({ query: 'electrolysis', grade: 10, subjectId: 's1', candidates, topK: 2 });
    expect(out).toHaveLength(2);
  });

  it('ranks by Gemini relevance score when the call succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockGeminiResponse([{ index: 0, score: 0.1 }, { index: 1, score: 0.95 }]),
    ) as unknown as typeof fetch;

    const r = new GeminiReRanker({ apiKey: 'test-key' });
    const low = makeHit('irrelevant passage', 't1', 0.5);
    const high = makeHit('directly answers the question', 't1', 0.5);
    const out = await r.rerank({ query: 'q', grade: 10, subjectId: 's1', candidates: [low, high], topK: 2 });
    expect(out[0]?.chunk.id).toBe(high.chunk.id);
  });

  it('falls back to lexical scoring when the Gemini call fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const r = new GeminiReRanker({ apiKey: 'test-key' });
    const relevant = makeHit('photosynthesis is the process by which plants convert light energy', 't1', 0.5);
    const irrelevant = makeHit('history of ethiopian federalism', 't2', 0.5);
    const out = await r.rerank({
      query: 'photosynthesis plants light energy',
      grade: 9,
      subjectId: 's1',
      candidates: [irrelevant, relevant],
      topK: 2,
    });
    // Should not throw, and lexical fallback should still favor the relevant chunk.
    expect(out[0]?.chunk.id).toBe(relevant.chunk.id);
  });

  it('falls back to lexical scoring when the response has no parseable JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'sorry, I cannot do that' }] } }] }),
    }) as unknown as typeof fetch;

    const r = new GeminiReRanker({ apiKey: 'test-key' });
    const candidates = [makeHit('a', 't1', 0.3), makeHit('b', 't1', 0.7)];
    const out = await r.rerank({ query: 'q', grade: 10, subjectId: 's1', candidates, topK: 2 });
    expect(out).toHaveLength(2);
  });

  it('applies the topic metadata boost on top of the LLM score', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockGeminiResponse([{ index: 0, score: 0.5 }, { index: 1, score: 0.5 }]),
    ) as unknown as typeof fetch;

    const r = new GeminiReRanker({ apiKey: 'test-key' });
    const offTopic = makeHit('electrolysis of brine', 'topicB', 0.5);
    const onTopic = makeHit('electrolysis of water', 'topicA', 0.5);
    const out = await r.rerank({
      query: 'electrolysis',
      grade: 10,
      subjectId: 's1',
      topicId: 'topicA',
      candidates: [offTopic, onTopic],
      topK: 2,
    });
    expect(out[0]?.chunk.topicId).toBe('topicA');
  });
});
