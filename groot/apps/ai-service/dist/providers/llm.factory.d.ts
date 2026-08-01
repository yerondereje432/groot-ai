/**
 * Embedding provider abstraction.
 *
 * Per spec §14: "Embed (embedding model)" — interface so the model can be
 * swapped (OpenAI text-embedding-3-small, bge-small, Cohere, etc.) without
 * touching the retriever.
 */
export interface EmbeddingProvider {
    readonly name: string;
    readonly dimension: number;
    /** Returns a single embedding. */
    embed(text: string): Promise<number[]>;
    /** Batch embeddings. Implementations should send a single API call when possible (§37). */
    embedBatch(texts: string[]): Promise<number[][]>;
}
//# sourceMappingURL=llm.factory.d.ts.map