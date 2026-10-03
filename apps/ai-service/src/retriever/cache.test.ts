import { describe, it, expect, vi } from 'vitest';
import { createSemanticCache, InMemorySemanticCache, RedisSemanticCache } from './cache.js';

describe('createSemanticCache', () => {
  it('returns an InMemorySemanticCache when provider is "memory"', async () => {
    const cache = await createSemanticCache({
      provider: 'memory',
      redisUrl: 'redis://localhost:6379',
      ttlSeconds: 60,
    });
    expect(cache).toBeInstanceOf(InMemorySemanticCache);
  });

  it('falls back to InMemorySemanticCache when provider is "redis" but Redis is unreachable', async () => {
    const warn = vi.fn();
    // Unroutable address with a short connectTimeout — forces a connection
    // failure quickly instead of hanging, exercising the fail-open path.
    const cache = await createSemanticCache({
      provider: 'redis',
      redisUrl: 'redis://10.255.255.1:6379',
      ttlSeconds: 60,
      logger: { warn },
    });
    expect(cache).toBeInstanceOf(InMemorySemanticCache);
    // The low-level ioredis connection-error listener and the high-level
    // fallback message can both fire (order/count depends on timing), but
    // the fallback message must be among them — that's the behavior that
    // actually matters (we degrade gracefully instead of crashing on an
    // unhandled 'error' event).
    expect(warn.mock.calls.some(call => /falling back to the in-memory cache/i.test(call[0]))).toBe(true);
  }, 10_000);

  it('RedisSemanticCache round-trips through a minimal redis-like client', async () => {
    const store = new Map<string, string>();
    const fakeRedis = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      },
    };
    const cache = new RedisSemanticCache(fakeRedis, 60);
    expect(await cache.get('q', 9, 'subject-1')).toBeNull();

    const hits = [
      {
        chunk: {
          id: 'c1',
          topicId: 't1',
          content: 'x',
          sourceRef: 'src',
          version: '2024.1',
          status: 'published' as const,
          createdAt: '2024-01-01T00:00:00Z',
        },
        score: 0.9,
      },
    ];
    await cache.set('q', 9, 'subject-1', hits);
    const got = await cache.get('q', 9, 'subject-1');
    expect(got?.[0]?.chunk.id).toBe('c1');
  });
});
