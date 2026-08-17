/**
 * Retriever — combines vector store + re-ranker + cache.
 *
 * Per spec §14: hybrid search, metadata filtering, re-rank top-20→top-5.
 * Per spec §37: semantic cache for repeated queries.
 */
export const DEFAULT_RETRIEVER_CONFIG = {
    topKPreRerank: 20,
    topKPostRerank: 5,
    minConfidence: 0.35,
};
export class Retriever {
    constructor(deps, cfg = DEFAULT_RETRIEVER_CONFIG) {
        this.deps = deps;
        this.cfg = cfg;
    }
    async retrieve(input) {
        const start = Date.now();
        // 1. Cache lookup — §37 cost optimization.
        const cached = await this.deps.cache.get(input.query, input.grade, input.subjectId);
        if (cached) {
            return {
                hits: cached,
                hasConfidentAnswer: cached.length > 0 && (cached[0]?.score ?? 0) >= this.cfg.minConfidence,
                topScore: cached[0]?.score ?? 0,
                latencyMs: Date.now() - start,
            };
        }
        // 2. Embed query.
        const embedding = input.queryEmbedding ?? await this.deps.embedder.embed(input.query);
        // 3. Hybrid search with metadata filtering (§14).
        const q = {
            queryEmbedding: embedding,
            queryText: input.query,
            grade: input.grade,
            subjectId: input.subjectId,
            topicId: input.topicId,
            topK: this.cfg.topKPreRerank,
        };
        const raw = await this.deps.store.hybridSearch(q);
        // 4. Re-rank (§14).
        const reranked = await this.deps.reranker.rerank({
            query: input.query,
            grade: input.grade,
            subjectId: input.subjectId,
            topicId: input.topicId,
            candidates: raw,
            topK: this.cfg.topKPostRerank,
        });
        // 5. Cache the final result.
        await this.deps.cache.set(input.query, input.grade, input.subjectId, reranked);
        return {
            hits: reranked,
            hasConfidentAnswer: reranked.length > 0 && (reranked[0]?.score ?? 0) >= this.cfg.minConfidence,
            topScore: reranked[0]?.score ?? 0,
            latencyMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=retriever.js.map