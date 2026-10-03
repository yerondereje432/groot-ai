/**
 * Semantic cache for retrieval results.
 *
 * Per spec §37: "Semantic caching: serve repeated/similar queries from cache."
 *
 * MVP implementation: exact-match keyed by (normalized query, grade, subject).
 * A real semantic cache would key by embedding similarity (e.g., Redis with
 * vector search, or a dedicated cache like GPTCache). The interface is
 * designed so that swap is mechanical.
 */

import type { RetrievalHit } from '@groot/shared-types';

export interface SemanticCache {
  get(query: string, grade: number, subjectId: string): Promise<RetrievalHit[] | null>;
  set(query: string, grade: number, subjectId: string, hits: RetrievalHit[]): Promise<void>;
}

export class InMemorySemanticCache implements SemanticCache {
  private readonly store = new Map<string, { hits: RetrievalHit[]; expires: number }>();

  constructor(private readonly ttlSeconds: number = 3600) {}

  async get(query: string, grade: number, subjectId: string): Promise<RetrievalHit[] | null> {
    const key = this.key(query, grade, subjectId);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.hits;
  }

  async set(query: string, grade: number, subjectId: string, hits: RetrievalHit[]): Promise<void> {
    const key = this.key(query, grade, subjectId);
    this.store.set(key, { hits, expires: Date.now() + this.ttlSeconds * 1000 });
  }

  private key(query: string, grade: number, subjectId: string): string {
    const norm = query.toLowerCase().replace(/\s+/g, ' ').trim();
    return `${grade}|${subjectId}|${norm}`;
  }
}

/**
 * Redis-backed semantic cache.
 * Same interface as InMemorySemanticCache; used in production per §37.
 */
export class RedisSemanticCache implements SemanticCache {
  constructor(
    private readonly redis: { get(key: string): Promise<string | null>; set(key: string, value: string, mode: string, duration: number): Promise<unknown> },
    private readonly ttlSeconds: number = 3600,
  ) {}

  async get(query: string, grade: number, subjectId: string): Promise<RetrievalHit[] | null> {
    const key = this.key(query, grade, subjectId);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RetrievalHit[];
    } catch {
      return null;
    }
  }

  async set(query: string, grade: number, subjectId: string, hits: RetrievalHit[]): Promise<void> {
    const key = this.key(query, grade, subjectId);
    await this.redis.set(key, JSON.stringify(hits), 'EX', this.ttlSeconds);
  }

  private key(query: string, grade: number, subjectId: string): string {
    const norm = query.toLowerCase().replace(/\s+/g, ' ').trim();
    return `groot:rag:${grade}:${subjectId}:${norm}`;
  }
}

/**
 * Builds the configured cache, with a safe fallback.
 *
 * `CACHE_PROVIDER=redis` shares the cache across every ai-service replica —
 * without it, each horizontally-scaled instance has its own in-memory cache
 * and the advertised "cost optimization via caching" (§37) silently stops
 * working the moment you run more than one pod. If Redis can't be reached
 * at boot (wrong URL, service down), this logs a warning and degrades to
 * the in-memory cache rather than failing startup — same fail-open pattern
 * used for the LLM/embedding/re-ranker providers elsewhere in this service.
 */
export async function createSemanticCache(opts: {
  provider: 'memory' | 'redis';
  redisUrl: string;
  ttlSeconds: number;
  logger?: { warn: (msg: string) => void };
}): Promise<SemanticCache> {
  if (opts.provider !== 'redis') {
    return new InMemorySemanticCache(opts.ttlSeconds);
  }

  try {
    const { default: IORedis } = await import('ioredis');
    const client = new IORedis(opts.redisUrl, {
      // Fail fast at boot rather than retrying forever — we want to fall
      // back to the in-memory cache quickly, not hang startup.
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      connectTimeout: 2000,
    });
    // Attach the error listener BEFORE connecting. ioredis throws an
    // uncaught exception (crashing the process) if an 'error' event fires
    // with zero listeners attached — attaching it only after a failed
    // connect()/ping() (as a naive try/catch might) is too late, because
    // the socket can still emit further async errors afterwards.
    client.on('error', (err: Error) => {
      opts.logger?.warn(`Redis cache connection error (continuing, cache may degrade): ${err.message}`);
    });
    await client.connect();
    await client.ping();
    return new RedisSemanticCache(client, opts.ttlSeconds);
  } catch (err) {
    opts.logger?.warn(
      `CACHE_PROVIDER=redis requested but Redis is unreachable (${(err as Error).message}); ` +
        `falling back to the in-memory cache. This works for a single instance but will not ` +
        `share cache state once you run more than one ai-service replica.`,
    );
    return new InMemorySemanticCache(opts.ttlSeconds);
  }
}
