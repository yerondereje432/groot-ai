import { describe, it, expect, beforeEach } from 'vitest';
import { Retriever, DEFAULT_RETRIEVER_CONFIG } from './retriever.js';
import { StubEmbeddingProvider } from '../providers/embedding.stub.js';
import { InMemorySemanticCache } from './cache.js';
import { StubReRanker } from './reranker.stub.js';
import type { RetrievalHit } from '@groot/shared-types';
import type { HybridQuery, VectorStore } from './vector-store.js';
import type { RerankInput, ReRanker } from './reranker.js';

/** Wraps any ReRanker and counts how many times `rerank` was actually invoked. */
class CountingReRanker implements ReRanker {
  readonly name = 'counting';
  calls = 0;
  constructor(private readonly inner: ReRanker) {}
  async rerank(input: RerankInput): Promise<RetrievalHit[]> {
    this.calls++;
    return this.inner.rerank(input);
  }
}

class FakeStore implements VectorStore {
  public readonly indexed: Array<{ id: string; topicId: string; content: string; embedding: number[] }> = [];

  async upsertChunk(input: { id: string; topicId: string; content: string; sourceRef: string; version: string; embedding: number[]; }): Promise<void> {
    this.indexed.push({ id: input.id, topicId: input.topicId, content: input.content, embedding: input.embedding });
  }

  async hybridSearch(q: HybridQuery): Promise<RetrievalHit[]> {
    // Cosine similarity against indexed chunks.
    const scored = this.indexed.map((c, i) => {
      const cos = cosSim(q.queryEmbedding, c.embedding);
      return {
        hit: {
          chunk: {
            id: c.id,
            topicId: c.topicId,
            content: c.content,
            sourceRef: `src-${i}`,
            version: '2024.1',
            status: 'published' as const,
            createdAt: '2024-01-01T00:00:00Z',
          },
          score: cos,
          scoreBreakdown: { vector: cos, bm25: 0, rerank: 0, metadataBoost: 0 },
        },
        cos,
      };
    });
    scored.sort((a, b) => b.cos - a.cos);
    return scored.slice(0, q.topK).map(s => s.hit);
  }

  async getChunk(id: string): Promise<{ id: string; topicId: string; content: string; sourceRef: string } | null> {
    const found = this.indexed.find(c => c.id === id);
    return found ? { id: found.id, topicId: found.topicId, content: found.content, sourceRef: `src-${found.id}` } : null;
  }
}

function cosSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

describe('Retriever', () => {
  let store: FakeStore;
  let cache: InMemorySemanticCache;
  let retriever: Retriever;
  const subjectId = 'subject-1';

  beforeEach(async () => {
    store = new FakeStore();
    cache = new InMemorySemanticCache(60);
    const embedder = new StubEmbeddingProvider(64);

    // Pre-populate the fake vector store with two chunks.
    await store.upsertChunk({
      id: 'c1', topicId: 'topic-photosynthesis', sourceRef: 'Grade-9-Science p.10',
      version: '2024.1', content: 'photosynthesis converts light energy into chemical energy in plants',
      embedding: await embedder.embed('photosynthesis converts light energy into chemical energy in plants'),
    });
    await store.upsertChunk({
      id: 'c2', topicId: 'topic-electrolysis', sourceRef: 'Grade-10-Chem p.42',
      version: '2024.1', content: 'electrolysis decomposes water into hydrogen and oxygen using electric current',
      embedding: await embedder.embed('electrolysis decomposes water into hydrogen and oxygen using electric current'),
    });

    retriever = new Retriever(
      { embedder, store, reranker: new StubReRanker(), cache },
      { ...DEFAULT_RETRIEVER_CONFIG, minConfidence: 0.0 }, // disable threshold for unit test
    );
  });

  it('retrieves top chunks and marks as confident when score is high', async () => {
    const r = await retriever.retrieve({
      query: 'photosynthesis plants light',
      grade: 9,
      subjectId,
    });
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hasConfidentAnswer).toBe(true);
    expect(r.hits[0]?.chunk.id).toBe('c1');
  });

  it('caches repeated queries', async () => {
    const r1 = await retriever.retrieve({ query: 'electrolysis water', grade: 10, subjectId });
    expect(r1.hits.length).toBeGreaterThan(0);

    // Mutate the underlying store to confirm second call returns cached result.
    const originalLen = store.indexed.length;
    await store.upsertChunk({
      id: 'c3', topicId: 'topic-electrolysis', sourceRef: 'Grade-10-Chem p.99',
      version: '2024.1', content: 'something completely different',
      embedding: Array(64).fill(0).map(() => Math.random()),
    });
    const r2 = await retriever.retrieve({ query: 'electrolysis water', grade: 10, subjectId });
    expect(r2.hits[0]?.chunk.id).toBe(r1.hits[0]?.chunk.id); // same first hit (cached)
    expect(store.indexed.length).toBe(originalLen + 1); // store grew but cache ignored it
  });

  it('respects topicId filter in metadata', async () => {
    const r = await retriever.retrieve({
      query: 'electrolysis',
      grade: 10,
      subjectId,
      topicId: 'topic-photosynthesis', // intentionally wrong topic
    });
    // Re-ranker should still pull both candidates, but topicBoost pushes
    // the photosynthesis chunk up.
    const ids = r.hits.map(h => h.chunk.id);
    expect(ids).toContain('c1'); // photosynthesis now boosted
  });

  it('skips the re-ranker call when the top pre-rerank score already clears rerankSkipThreshold', async () => {
    const embedder = new StubEmbeddingProvider(64);
    const counting = new CountingReRanker(new StubReRanker());
    const skipRetriever = new Retriever(
      { embedder, store, reranker: counting, cache: new InMemorySemanticCache(60) },
      { ...DEFAULT_RETRIEVER_CONFIG, minConfidence: 0.0, rerankSkipThreshold: 0.5 },
    );

    // Exact-text match against an indexed chunk — cosine similarity should
    // be effectively 1.0 (well above the 0.5 skip threshold).
    const r = await skipRetriever.retrieve({
      query: 'photosynthesis converts light energy into chemical energy in plants',
      grade: 9,
      subjectId,
    });

    expect(counting.calls).toBe(0);
    expect(r.timings?.rerankSkipped).toBe(true);
    expect(r.hits[0]?.chunk.id).toBe('c1');
  });

  it('still calls the re-ranker when the top pre-rerank score is below rerankSkipThreshold', async () => {
    const embedder = new StubEmbeddingProvider(64);
    const counting = new CountingReRanker(new StubReRanker());
    const noSkipRetriever = new Retriever(
      { embedder, store, reranker: counting, cache: new InMemorySemanticCache(60) },
      { ...DEFAULT_RETRIEVER_CONFIG, minConfidence: 0.0, rerankSkipThreshold: 0.999 },
    );

    const r = await noSkipRetriever.retrieve({
      query: 'photosynthesis plants light',
      grade: 9,
      subjectId,
    });

    expect(counting.calls).toBe(1);
    expect(r.timings?.rerankSkipped).toBe(false);
  });
});
