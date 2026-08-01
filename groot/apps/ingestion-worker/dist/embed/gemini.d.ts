import type { EmbeddingProvider } from './index.js';
export declare class GeminiEmbeddingProvider implements EmbeddingProvider {
    readonly name = "gemini";
    readonly dimension: number;
    private readonly apiKey;
    private readonly model;
    private readonly baseUrl;
    constructor(apiKey: string, model?: string, dimension?: number);
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}
//# sourceMappingURL=gemini.d.ts.map