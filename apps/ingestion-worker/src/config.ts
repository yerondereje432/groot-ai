export interface AppConfig {
  databaseUrl: string;
  redisUrl: string;
  queueName: string;
  concurrency: number;
  embeddingDim: number;
  embeddingProvider: 'stub' | 'gemini';
  geminiApiKey?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const num = (v: string | undefined, def: number): number => {
    if (!v) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const str = (v: string | undefined, def: string): string => (v && v.length > 0 ? v : def);
  return {
    databaseUrl: str(env.DATABASE_URL, 'postgresql://groot:groot_dev_password@localhost:5432/groot'),
    redisUrl: str(env.REDIS_URL, 'redis://localhost:6379'),
    queueName: str(env.INGESTION_QUEUE_NAME, 'groot:ingestion'),
    concurrency: num(env.INGESTION_CONCURRENCY, 2),
    embeddingDim: num(env.EMBEDDING_DIM, 384),
    embeddingProvider: str(env.EMBEDDING_PROVIDER, 'stub') as 'stub' | 'gemini',
    geminiApiKey: env.GEMINI_API_KEY,
  };
}
