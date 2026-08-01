/**
 * Embedder — wraps the embedding provider for batch ingestion.
 *
 * Per spec §16 step 5: "Embedding — batch embed, store in vector DB."
 * Per spec §37: "Embeddings — batch and cache; re-embed only changed chunks."
 *
 * The ingestion worker uses its own local stub embedder for the vertical.
 * A production deployment should call the AI service's /v1/embed endpoint
 * (or a shared library) to keep the embedding model in lock-step.
 */
export interface EmbeddingProvider {
    readonly name: string;
    readonly dimension: number;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}
export declare function localEmbeddingProvider(dimension?: number, provider?: 'stub' | 'gemini', apiKey?: string): EmbeddingProvider;
//# sourceMappingURL=index.d.ts.map