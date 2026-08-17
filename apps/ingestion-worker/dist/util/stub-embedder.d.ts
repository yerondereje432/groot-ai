/**
 * Local stub embedder — duplicated from AI service to keep the worker
 * independently runnable. A real deployment would call the AI service
 * over HTTP, but for the vertical we keep everything in-process to
 * minimize moving parts.
 *
 * IMPORTANT: keep this class byte-for-byte compatible with the AI service's
 * StubEmbeddingProvider. If you change one, change both. (See ASSUMPTIONS.md.)
 */
export interface EmbeddingProvider {
    readonly name: string;
    readonly dimension: number;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}
export declare class StubEmbeddingProvider implements EmbeddingProvider {
    readonly name = "stub";
    readonly dimension: number;
    constructor(dimension?: number);
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    private embedOne;
    private tokenize;
    private hash32;
    private l2Normalize;
}
//# sourceMappingURL=stub-embedder.d.ts.map