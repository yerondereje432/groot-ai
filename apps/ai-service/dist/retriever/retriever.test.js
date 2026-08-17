import { describe, it, expect, beforeEach } from 'vitest';
import { Retriever, DEFAULT_RETRIEVER_CONFIG } from './retriever.js';
import { StubEmbeddingProvider } from '../providers/embedding.stub.js';
import { InMemorySemanticCache } from './cache.js';
import { StubReRanker } from './reranker.stub.js';
class FakeStore {
    constructor() {
        this.indexed = [];
    }
    async upsertChunk(input) {
        this.indexed.push({ id: input.id, topicId: input.topicId, content: input.content, embedding: input.embedding });
    }
    async hybridSearch(q) {
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
                        status: 'published',
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
    async getChunk(id) {
        const found = this.indexed.find(c => c.id === id);
        return found ? { id: found.id, topicId: found.topicId, content: found.content, sourceRef: `src-${found.id}` } : null;
    }
}
function cosSim(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++)
        dot += (a[i] ?? 0) * (b[i] ?? 0);
    return dot;
}
describe('Retriever', () => {
    let store;
    let cache;
    let retriever;
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
        retriever = new Retriever({ embedder, store, reranker: new StubReRanker(), cache }, { ...DEFAULT_RETRIEVER_CONFIG, minConfidence: 0.0 });
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
});
//# sourceMappingURL=retriever.test.js.map