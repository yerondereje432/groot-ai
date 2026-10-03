/**
 * Retriever — combines vector store + re-ranker + cache.
 *
 * Per spec §14: hybrid search, metadata filtering, re-rank top-20→top-5.
 * Per spec §37: semantic cache for repeated queries.
 */

import type {
  RetrievalHit,
  RetrievalResult,
} from '@groot/shared-types';
import type { EmbeddingProvider } from '../providers/llm.factory.js';
import type { VectorStore, HybridQuery } from './vector-store.js';
import type { ReRanker } from './reranker.js';
import type { SemanticCache } from './cache.js';

export interface RetrieverConfig {
  /** Top-K to pull from vector store before re-ranking. Default 20 per §14. */
  topKPreRerank: number;
  /** Top-K after re-ranking. Default 5 per §14. */
  topKPostRerank: number;
  /** Below this score, the orchestrator refuses (§13 guardrail). */
  minConfidence: number;
  /**
   * If the top pre-rerank hybrid score already exceeds this, skip the
   * re-ranker call and just truncate to topKPostRerank. Only meaningful for
   * LLM-based re-rankers (GeminiReRanker) where skipping saves a network
   * round-trip + token cost on every tutor turn; the free lexical
   * StubReRanker has no such cost, but honors this too for consistency.
   * Default is intentionally high (0.92) so it only fires for near-exact
   * matches, not the common "pretty good match" case.
   */
  rerankSkipThreshold: number;
}

export const DEFAULT_RETRIEVER_CONFIG: RetrieverConfig = {
  topKPreRerank: 20,
  topKPostRerank: 5,
  minConfidence: 0.35,
  rerankSkipThreshold: 0.92,
};

export interface RetrieverDeps {
  embedder: EmbeddingProvider;
  store: VectorStore;
  reranker: ReRanker;
  cache: SemanticCache;
}

export class Retriever {
  constructor(
    private readonly deps: RetrieverDeps,
    private readonly cfg: RetrieverConfig = DEFAULT_RETRIEVER_CONFIG,
  ) {}

  async retrieve(input: {
    query: string;
    grade: 9 | 10 | 11 | 12;
    subjectId: string;
    topicId?: string;
    /** Optional pre-computed embedding (used by ingestion validation). */
    queryEmbedding?: number[];
  }): Promise<RetrievalResult> {
    const start = Date.now();

    // 1. Cache lookup — §37 cost optimization.
    const cached = await this.deps.cache.get(input.query, input.grade, input.subjectId);
    if (cached) {
      return {
        hits: cached,
        hasConfidentAnswer: cached.length > 0 && (cached[0]?.score ?? 0) >= this.cfg.minConfidence,
        topScore: cached[0]?.score ?? 0,
        latencyMs: Date.now() - start,
        timings: { cacheHit: true, embedMs: 0, searchMs: 0, rerankMs: 0, rerankSkipped: false },
      };
    }

    // 2. Embed query.
    const embedStart = Date.now();
    const embedding = input.queryEmbedding ?? await this.deps.embedder.embed(input.query);
    const embedMs = Date.now() - embedStart;

    // 3. Hybrid search with metadata filtering (§14).
    const q: HybridQuery = {
      queryEmbedding: embedding,
      queryText: input.query,
      grade: input.grade,
      subjectId: input.subjectId,
      topicId: input.topicId,
      topK: this.cfg.topKPreRerank,
    };
    const searchStart = Date.now();
    const raw: RetrievalHit[] = await this.deps.store.hybridSearch(q);
    const searchMs = Date.now() - searchStart;

    // 4. Re-rank (§14) — unless the top pre-rerank hit is already such an
    // obvious match (>= rerankSkipThreshold) that spending a network
    // round-trip (and, for GeminiReRanker, LLM tokens) on re-ranking isn't
    // worth the latency/cost. This is the common "student asked a question
    // that closely matches one chunk's wording" case.
    const topPreRerankScore = raw.length > 0 ? Math.max(...raw.map(h => h.score)) : 0;
    const shouldSkipRerank = topPreRerankScore >= this.cfg.rerankSkipThreshold;

    const rerankStart = Date.now();
    const reranked = shouldSkipRerank
      ? [...raw].sort((a, b) => b.score - a.score).slice(0, this.cfg.topKPostRerank)
      : await this.deps.reranker.rerank({
          query: input.query,
          grade: input.grade,
          subjectId: input.subjectId,
          topicId: input.topicId,
          candidates: raw,
          topK: this.cfg.topKPostRerank,
        });
    const rerankMs = Date.now() - rerankStart;

    // 5. Cache the final result.
    await this.deps.cache.set(
      input.query,
      input.grade,
      input.subjectId,
      reranked,
    );

    return {
      hits: reranked,
      hasConfidentAnswer: reranked.length > 0 && (reranked[0]?.score ?? 0) >= this.cfg.minConfidence,
      topScore: reranked[0]?.score ?? 0,
      latencyMs: Date.now() - start,
      timings: { cacheHit: false, embedMs, searchMs, rerankMs, rerankSkipped: shouldSkipRerank },
    };
  }
}
