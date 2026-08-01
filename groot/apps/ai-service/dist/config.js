/**
 * Centralized configuration for the AI service.
 * Per spec §29: 12-factor env-driven config.
 */
export function loadConfig(env = process.env) {
    const num = (v, def) => {
        if (!v)
            return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    };
    const str = (v, def) => (v && v.length > 0 ? v : def);
    return {
        port: num(env.PORT, 4001),
        nodeEnv: str(env.NODE_ENV, 'development'),
        logLevel: str(env.LOG_LEVEL, 'info'),
        databaseUrl: str(env.DATABASE_URL, 'postgresql://groot:groot_dev_password@localhost:5432/groot'),
        redisUrl: str(env.REDIS_URL, 'redis://localhost:6379'),
        geminiApiKey: env.GEMINI_API_KEY,
        embeddingProvider: str(env.EMBEDDING_PROVIDER, 'stub'),
        embeddingModel: str(env.EMBEDDING_MODEL, 'groot-stub-embed-v0'),
        embeddingDim: num(env.EMBEDDING_DIM, 384),
        llmProvider: str(env.LLM_PROVIDER, 'stub'),
        llmModel: str(env.LLM_MODEL, 'groot-stub-v0'),
        rerankerProvider: str(env.RERANKER_PROVIDER, 'stub'),
        ragTopKPreRerank: num(env.RAG_TOP_K, 20),
        ragTopKPostRerank: num(env.RAG_RERANK_TOP_K, 5),
        ragMinConfidence: num(env.RAG_MIN_CONFIDENCE, 0.35),
        ragCacheTtlSeconds: num(env.RAG_CACHE_TTL_SECONDS, 3600),
    };
}
//# sourceMappingURL=config.js.map