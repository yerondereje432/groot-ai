import { describe, it, expect } from 'vitest';
import { StubReRanker } from './reranker.stub.js';
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

describe('StubReRanker', () => {
  it('returns at most topK results', async () => {
    const r = new StubReRanker();
    const candidates = [
      makeHit('electrolysis of water produces hydrogen', 't1', 0.5),
      makeHit('history of ethiopia', 't2', 0.4),
      makeHit('electrolysis in industry', 't1', 0.6),
    ];
    const out = await r.rerank({
      query: 'electrolysis',
      grade: 10,
      subjectId: 's1',
      candidates,
      topK: 2,
    });
    expect(out).toHaveLength(2);
  });

  it('boosts chunks in the requested topic', async () => {
    const r = new StubReRanker();
    const onTopic = makeHit('electrolysis of water', 'topicA', 0.5);
    const offTopic = makeHit('electrolysis of brine', 'topicB', 0.5);
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

  it('ranks lexically overlapping chunks higher', async () => {
    const r = new StubReRanker();
    const relevant = makeHit('photosynthesis is the process by which plants convert light energy', 't1', 0.5);
    const irrelevant = makeHit('history of ethiopian federalism', 't2', 0.5);
    const out = await r.rerank({
      query: 'photosynthesis plants light energy',
      grade: 9,
      subjectId: 's1',
      candidates: [irrelevant, relevant],
      topK: 2,
    });
    expect(out[0]?.chunk.id).toBe(relevant.chunk.id);
  });
});
