/**
 * Re-ranker abstraction.
 *
 * Per spec §14: "Re-ranking (cross-encoder or LLM-based) on top-20 → top-5."
 * Implementations must be deterministic enough for the RAG eval gate (§32).
 */
import type { RetrievalHit } from '@groot/shared-types';
export interface RerankInput {
    query: string;
    grade: 9 | 10 | 11 | 12;
    subjectId: string;
    /** Optional topic filter — boosts matches in the requested topic. */
    topicId?: string;
    candidates: RetrievalHit[];
    /** How many to return. Default 5 per §14. */
    topK: number;
}
export interface ReRanker {
    readonly name: string;
    rerank(input: RerankInput): Promise<RetrievalHit[]>;
}
//# sourceMappingURL=reranker.d.ts.map