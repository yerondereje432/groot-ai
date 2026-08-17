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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const num = (v: string | undefined, def: number): number => {
    if (!v) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const str = (v: string | undefined, def: string): string => (v && v.length > 0 ? v : def);

  return {
    port: num(env.PORT, 4001),
    nodeEnv: str(env.NODE_ENV, 'development'),
    logLevel: str(env.LOG_LEVEL, 'info'),

    databaseUrl: str(env.DATABASE_URL, 'postgresql://groot:groot_dev_password@localhost:5432/groot'),
    redisUrl: str(env.REDIS_URL, 'redis://localhost:6379'),

    geminiApiKey: env.GEMINI_API_KEY,

    embeddingProvider: str(env.EMBEDDING_PROVIDER, 'stub') as AppConfig['embeddingProvider'],
    embeddingModel: str(env.EMBEDDING_MODEL, 'groot-stub-embed-v0'),
    embeddingDim: num(env.EMBEDDING_DIM, 384),

    llmProvider: str(env.LLM_PROVIDER, 'stub') as AppConfig['llmProvider'],
    llmModel: str(env.LLM_MODEL, 'groot-stub-v0'),

    rerankerProvider: str(env.RERANKER_PROVIDER, 'stub') as AppConfig['rerankerProvider'],

    ragTopKPreRerank: num(env.RAG_TOP_K, 20),
    ragTopKPostRerank: num(env.RAG_RERANK_TOP_K, 5),
    ragMinConfidence: num(env.RAG_MIN_CONFIDENCE, 0.35),
    ragCacheTtlSeconds: num(env.RAG_CACHE_TTL_SECONDS, 3600),
  };
}
