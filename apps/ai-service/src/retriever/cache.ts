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
