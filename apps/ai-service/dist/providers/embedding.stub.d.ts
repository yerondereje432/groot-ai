/**
 * Stub embedding provider.
 *
 * Produces deterministic bag-of-words vectors. This is intentionally simple
 * and is designed to be replaced by a real model without code changes —
 * the EmbeddingProvider interface is the contract.
 *
 * Properties:
 *   - Deterministic: same text always produces the same vector.
 *   - Bounded: vectors are L2-normalized so cosine similarity is meaningful.
 *   - Lexical: works well for short factual queries common in exam prep.
 *
 * Limitations (the reason to swap for a real model):
 *   - No semantic generalization (synonyms are orthogonal).
 *   - Limited recall on dense prose.
 *
 * For real model wiring, implement an OpenAIEmbeddingProvider or
 * BgeEmbeddingProvider against the same interface.
 */
import type { EmbeddingProvider } from './llm.factory.js';
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
//# sourceMappingURL=embedding.stub.d.ts.map