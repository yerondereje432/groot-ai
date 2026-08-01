/**
 * Stub cross-encoder re-ranker.
 *
 * Real production would use a model like `cross-encoder/ms-marco-MiniLM-L-6-v2`.
 * This stub combines:
 *   1. Lexical overlap between query and chunk (Jaccard on tokens).
 *   2. A metadata match bonus when chunk.topic_id matches input.topicId.
 *
 * Designed so it can be replaced by a real cross-encoder with no code changes
 * elsewhere.
 */
import type { RetrievalHit } from '@groot/shared-types';
import type { RerankInput, ReRanker } from './reranker.js';
export declare class StubReRanker implements ReRanker {
    readonly name = "stub";
    rerank(input: RerankInput): Promise<RetrievalHit[]>;
    private tokenize;
    private jaccard;
}
//# sourceMappingURL=reranker.stub.d.ts.map