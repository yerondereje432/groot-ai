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
export declare class InMemorySemanticCache implements SemanticCache {
    private readonly ttlSeconds;
    private readonly store;
    constructor(ttlSeconds?: number);
    get(query: string, grade: number, subjectId: string): Promise<RetrievalHit[] | null>;
    set(query: string, grade: number, subjectId: string, hits: RetrievalHit[]): Promise<void>;
    private key;
}
/**
 * Redis-backed semantic cache.
 * Same interface as InMemorySemanticCache; used in production per §37.
 */
export declare class RedisSemanticCache implements SemanticCache {
    private readonly redis;
    private readonly ttlSeconds;
    constructor(redis: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string, mode: string, duration: number): Promise<unknown>;
    }, ttlSeconds?: number);
    get(query: string, grade: number, subjectId: string): Promise<RetrievalHit[] | null>;
    set(query: string, grade: number, subjectId: string, hits: RetrievalHit[]): Promise<void>;
    private key;
}
//# sourceMappingURL=cache.d.ts.map