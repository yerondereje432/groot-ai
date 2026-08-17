import type { LLMProvider, LLMCompletionRequest, LLMCompletionResult, LLMTokenChunk } from './llm.interface.js';
import type { EmbeddingProvider } from './llm.factory.js';
export declare class GeminiProvider implements LLMProvider, EmbeddingProvider {
    readonly name = "gemini";
    readonly dimension: number;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly generationModel;
    private readonly embeddingModel;
    constructor(options: {
        apiKey: string;
        generationModel?: string;
        embeddingModel?: string;
        dimension?: number;
    });
    stream(req: LLMCompletionRequest): AsyncIterable<LLMTokenChunk>;
    complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    private mapToGeminiBody;
}
//# sourceMappingURL=gemini.provider.d.ts.map