export function loadConfig(env = process.env) {
    const num = (v, def) => {
        if (!v)
            return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    };
    const str = (v, def) => (v && v.length > 0 ? v : def);
    return {
        databaseUrl: str(env.DATABASE_URL, 'postgresql://groot:groot_dev_password@localhost:5432/groot'),
        redisUrl: str(env.REDIS_URL, 'redis://localhost:6379'),
        queueName: str(env.INGESTION_QUEUE_NAME, 'groot:ingestion'),
        concurrency: num(env.INGESTION_CONCURRENCY, 2),
        embeddingDim: num(env.EMBEDDING_DIM, 384),
        embeddingProvider: str(env.EMBEDDING_PROVIDER, 'stub'),
        geminiApiKey: env.GEMINI_API_KEY,
    };
}
//# sourceMappingURL=config.js.map