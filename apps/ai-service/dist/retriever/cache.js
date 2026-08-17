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
export class InMemorySemanticCache {
    constructor(ttlSeconds = 3600) {
        this.ttlSeconds = ttlSeconds;
        this.store = new Map();
    }
    async get(query, grade, subjectId) {
        const key = this.key(query, grade, subjectId);
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expires) {
            this.store.delete(key);
            return null;
        }
        return entry.hits;
    }
    async set(query, grade, subjectId, hits) {
        const key = this.key(query, grade, subjectId);
        this.store.set(key, { hits, expires: Date.now() + this.ttlSeconds * 1000 });
    }
    key(query, grade, subjectId) {
        const norm = query.toLowerCase().replace(/\s+/g, ' ').trim();
        return `${grade}|${subjectId}|${norm}`;
    }
}
/**
 * Redis-backed semantic cache.
 * Same interface as InMemorySemanticCache; used in production per §37.
 */
export class RedisSemanticCache {
    constructor(redis, ttlSeconds = 3600) {
        this.redis = redis;
        this.ttlSeconds = ttlSeconds;
    }
    async get(query, grade, subjectId) {
        const key = this.key(query, grade, subjectId);
        const raw = await this.redis.get(key);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async set(query, grade, subjectId, hits) {
        const key = this.key(query, grade, subjectId);
        await this.redis.set(key, JSON.stringify(hits), 'EX', this.ttlSeconds);
    }
    key(query, grade, subjectId) {
        const norm = query.toLowerCase().replace(/\s+/g, ' ').trim();
        return `groot:rag:${grade}:${subjectId}:${norm}`;
    }
}
//# sourceMappingURL=cache.js.map