/**
 * Centralized configuration for the AI service.
 * Per spec §29: 12-factor env-driven config.
 */
export interface AppConfig {
    port: number;
    nodeEnv: string;
    logLevel: string;
    databaseUrl: string;
    redisUrl: string;
    geminiApiKey?: string;
    embeddingProvider: 'stub' | 'openai' | 'bge' | 'gemini';
    embeddingModel: string;
    embeddingDim: number;
    llmProvider: 'stub' | 'openai' | 'anthropic' | 'gemini';
    llmModel: string;
    rerankerProvider: 'stub' | 'gemini';
    ragTopKPreRerank: number;
    ragTopKPostRerank: number;
    ragMinConfidence: number;
    ragCacheTtlSeconds: number;
}
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
//# sourceMappingURL=config.d.ts.map