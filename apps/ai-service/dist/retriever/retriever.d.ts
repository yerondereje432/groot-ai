/**
 * Retriever — combines vector store + re-ranker + cache.
 *
 * Per spec §14: hybrid search, metadata filtering, re-rank top-20→top-5.
 * Per spec §37: semantic cache for repeated queries.
 */
import type { RetrievalResult } from '@groot/shared-types';
import type { EmbeddingProvider } from '../providers/llm.factory.js';
import type { VectorStore } from './vector-store.js';
import type { ReRanker } from './reranker.js';
import type { SemanticCache } from './cache.js';
export interface RetrieverConfig {
    /** Top-K to pull from vector store before re-ranking. Default 20 per §14. */
    topKPreRerank: number;
    /** Top-K after re-ranking. Default 5 per §14. */
    topKPostRerank: number;
    /** Below this score, the orchestrator refuses (§13 guardrail). */
    minConfidence: number;
}
export declare const DEFAULT_RETRIEVER_CONFIG: RetrieverConfig;
export interface RetrieverDeps {
    embedder: EmbeddingProvider;
    store: VectorStore;
    reranker: ReRanker;
    cache: SemanticCache;
}
export declare class Retriever {
    private readonly deps;
    private readonly cfg;
    constructor(deps: RetrieverDeps, cfg?: RetrieverConfig);
    retrieve(input: {
        query: string;
        grade: 9 | 10 | 11 | 12;
        subjectId: string;
        topicId?: string;
        /** Optional pre-computed embedding (used by ingestion validation). */
        queryEmbedding?: number[];
    }): Promise<RetrievalResult>;
}
//# sourceMappingURL=retriever.d.ts.map