/**
 * LLM-based re-ranker backed by Gemini.
 *
 * Per spec §14: "Re-ranking (cross-encoder or LLM-based) on top-20 → top-5."
 * A hosted cross-encoder isn't available in this stack yet, so this implements
 * the LLM-based variant explicitly named as acceptable in the spec: a single
 * pointwise-scoring call asks Gemini to grade each candidate's relevance to
 * the query on a 0–1 scale, in the student's grade/subject context.
 *
 * Design notes:
 *   - One batched call per rerank (not one call per candidate) to keep latency
 *     and cost bounded — candidates are capped at topKPreRerank (20 per §14).
 *   - Blends the LLM relevance score with the upstream vector/BM25 score and
 *     the topic metadata boost, same 0.7/0.3 weighting the stub used, so
 *     swapping providers doesn't change the retrieval confidence semantics
 *     the orchestrator's guardrail (`minConfidence`) depends on.
 *   - On any failure (network, bad JSON, timeout) it falls back to the same
 *     lexical Jaccard scoring the stub uses, rather than throwing — a tutor
 *     answering with slightly worse ranking beats a tutor that's down.
 */
import type { RetrievalHit } from '@groot/shared-types';
import type { RerankInput, ReRanker } from './reranker.js';
export interface GeminiReRankerOptions {
    apiKey: string;
    model?: string;
    /** Max ms to wait for the scoring call before falling back to lexical scoring. */
    timeoutMs?: number;
}
export declare class GeminiReRanker implements ReRanker {
    readonly name = "gemini";
    private readonly apiKey;
    private readonly model;
    private readonly timeoutMs;
    private readonly baseUrl;
    constructor(options: GeminiReRankerOptions);
    rerank(input: RerankInput): Promise<RetrievalHit[]>;
    private scoreWithGemini;
    private truncate;
    private tokenize;
    private jaccard;
}
//# sourceMappingURL=reranker.gemini.d.ts.map