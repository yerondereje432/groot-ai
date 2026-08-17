import { describe, it, expect } from 'vitest';
import { Orchestrator } from './orchestrator.js';
import { StubLLMProvider } from '../providers/llm.stub.js';
import { StubEmbeddingProvider } from '../providers/embedding.stub.js';
import { StubReRanker } from '../retriever/reranker.stub.js';
import { InMemorySemanticCache } from '../retriever/cache.js';
import { Retriever, DEFAULT_RETRIEVER_CONFIG } from '../retriever/retriever.js';
import type { HybridQuery, VectorStore } from '../retriever/vector-store.js';
import type { RetrievalHit } from '@groot/shared-types';
import { nanoid } from 'nanoid';

class FakeStore implements VectorStore {
  async upsertChunk(): Promise<void> { /* noop */ }
  async hybridSearch(q: HybridQuery): Promise<RetrievalHit[]> {
    return [
      {
        chunk: {
          id: 'c1',
          topicId: 'topic-federalism',
          content: 'Federalism divides power between a central government and regional states. In Ethiopia, this includes the federal government, regional states, and city administrations.',
          sourceRef: 'Grade-10-Civics p.21',
          version: '2024.1',
          status: 'published',
          createdAt: '2024-01-01T00:00:00Z',
        },
        score: 0.85,
        scoreBreakdown: { vector: 0.85, bm25: 0, rerank: 0, metadataBoost: 0 },
      },
    ];
  }
  async getChunk(id: string) {
    return id === 'c1' ? { id, topicId: 'topic-federalism', content: 'Federalism...', sourceRef: 'Grade-10-Civics p.21' } : null;
  }
}

function buildOrchestrator(minConfidence = 0.35) {
  const store = new FakeStore();
  const embedder = new StubEmbeddingProvider(64);
  const cache = new InMemorySemanticCache(60);
  const retriever = new Retriever(
    { embedder, store, reranker: new StubReRanker(), cache },
    { ...DEFAULT_RETRIEVER_CONFIG, minConfidence },
  );
  return new Orchestrator(
    { llm: new StubLLMProvider(), retriever, generateSessionId: () => nanoid() },
    { ...DEFAULT_RETRIEVER_CONFIG, minConfidence },
  );
}

describe('Orchestrator', () => {
  it('streams start + citation + token events for a confident query', async () => {
    const o = buildOrchestrator(0.35);
    const events: unknown[] = [];
    for await (const ev of o.run({
      userId: '00000000-0000-4000-8000-000000000001',
      query: 'Explain federalism in simple terms',
      grade: 10,
      subjectId: 'subj-1',
      locale: 'en',
    })) {
      events.push(ev);
    }

    const types = events.map(e => (e as { type: string }).type);
    expect(types).toContain('start');
    expect(types).toContain('citation');
    expect(types).toContain('token');
    expect(types).toContain('done');

    const done = events.find(e => (e as { type: string }).type === 'done') as
      | { type: 'done'; citations: { sourceRef: string }[]; confidence: number }
      | undefined;
    expect(done?.citations.length).toBeGreaterThan(0);
    expect(done?.citations[0]?.sourceRef).toContain('Grade-10-Civics');
    expect(done?.confidence).toBeGreaterThan(0);
  });

  it('refuses (no LLM call) when retrieval confidence is below threshold', async () => {
    const o = buildOrchestrator(0.99); // impossibly high threshold
    const events: unknown[] = [];
    for await (const ev of o.run({
      userId: '00000000-0000-4000-8000-000000000001',
      query: 'Explain federalism',
      grade: 10,
      subjectId: 'subj-1',
      locale: 'en',
    })) {
      events.push(ev);
    }
    const types = events.map(e => (e as { type: string }).type);
    expect(types).toEqual(['refusal']);
    const refusal = events[0] as { type: 'refusal'; reason: string };
    expect(refusal.reason).toBe('low_retrieval_confidence');
  });

  it('emits Amharic refusal when locale is am and outside curriculum', async () => {
    const o = buildOrchestrator(0.99);
    const events: unknown[] = [];
    for await (const ev of o.run({
      userId: '00000000-0000-4000-8000-000000000001',
      query: 'ፌዴራሊዝም አብራሪ',
      grade: 10,
      subjectId: 'subj-1',
      locale: 'am',
    })) {
      events.push(ev);
    }
    const refusal = events[0] as { type: 'refusal'; message: string };
    expect(refusal.message).toContain('ኮሪኩለም');
  });

  it('runOnce returns answer with citations for confident query', async () => {
    const o = buildOrchestrator(0.35);
    const result = await o.runOnce({
      userId: '00000000-0000-4000-8000-000000000001',
      query: 'What is federalism?',
      grade: 10,
      subjectId: 'subj-1',
      locale: 'en',
    });
    expect(result.kind).toBe('answer');
    if (result.kind === 'answer') {
      expect(result.content).toContain('[Source:');
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.intent).toBe('explain');
    }
  });

  it('runOnce returns refusal for off-curriculum query', async () => {
    const o = buildOrchestrator(0.99);
    const result = await o.runOnce({
      userId: '00000000-0000-4000-8000-000000000001',
      query: 'What is the capital of France?',
      grade: 10,
      subjectId: 'subj-1',
      locale: 'en',
    });
    expect(result.kind).toBe('refusal');
  });
});
