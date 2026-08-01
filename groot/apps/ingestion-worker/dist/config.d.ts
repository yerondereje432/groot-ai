export interface AppConfig {
    databaseUrl: string;
    redisUrl: string;
    queueName: string;
    concurrency: number;
    embeddingDim: number;
    embeddingProvider: 'stub' | 'gemini';
    geminiApiKey?: string;
}
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
//# sourceMappingURL=config.d.ts.map