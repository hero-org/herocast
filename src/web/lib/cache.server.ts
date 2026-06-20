// SERVER-ONLY (`.server.ts`). Generic edge-cache seam shared by ported API routes.
//   The `cloudflare:workers` reach is via `env.server`; this module is mocked out of the
//   client bundle DETERMINISTICALLY by the default client deny-rule (`**/*.server.*`).
//
// HOST-PORTABLE behind a tiny CacheBackend: Cloudflare's Cache API where available
// (caches.default), else an in-process Map+TTL (Node/Vercel) that mirrors the live Next
// trending route's in-memory cache. This is the seam the 12 `unstable_cache` sites port
// onto in Phase 3.
export type Cached<T> = T & { cacheStatus: 'HIT' | 'MISS' | 'BYPASS' };

// Bodies are serialized JSON strings; (de)serialization lives in withCacheAPI so the
// backends stay dumb string stores.
export interface CacheBackend {
  read(key: string): Promise<string | undefined>;
  write(key: string, body: string, ttlSeconds: number): Promise<void>;
  readonly kind: 'cloudflare' | 'memory';
}

// Cloudflare Cache API. TTL rides on Cache-Control: max-age (the Cache API has NO tag
// invalidation; max-age is the only lever). Per-colo, not global.
class CloudflareCacheBackend implements CacheBackend {
  readonly kind = 'cloudflare' as const;
  constructor(private readonly cache: Cache) {}
  private req(key: string): Request {
    return new Request(`https://herocast-cache.internal/${encodeURIComponent(key)}`);
  }
  async read(key: string): Promise<string | undefined> {
    const hit = await this.cache.match(this.req(key));
    return hit ? hit.text() : undefined;
  }
  async write(key: string, body: string, ttlSeconds: number): Promise<void> {
    await this.cache.put(
      this.req(key),
      new Response(body, {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttlSeconds}` },
      })
    );
  }
}

// In-process Map+TTL for Node/Vercel (per-instance, ephemeral — same semantics as the
// live Next trending route's in-memory cache).
class MemoryCacheBackend implements CacheBackend {
  readonly kind = 'memory' as const;
  private readonly store = new Map<string, { body: string; expiresAt: number }>();
  async read(key: string): Promise<string | undefined> {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.body;
    if (entry) this.store.delete(key);
    return undefined;
  }
  async write(key: string, body: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { body, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

const memoryBackend = new MemoryCacheBackend();

// Pick the backend by runtime capability (not build TARGET), so the same bundle is
// correct on workerd (Cache API) and on Node/Vercel (Map) — checked per call since
// `caches.default` is a runtime global.
function getCacheBackend(): CacheBackend {
  const cfCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  return cfCache ? new CloudflareCacheBackend(cfCache) : memoryBackend;
}

// `shouldCache` lets a caller veto caching a particular result (e.g. don't cache a
// failed/empty Neynar response). Returns 'HIT' on a fresh-enough cached read, else
// 'MISS' (whether or not we then store). 'BYPASS' is retained in the type for callers
// that may disable caching later; it is no longer produced (a backend always exists).
export async function withCacheAPI<T>(
  key: string,
  ttl: number,
  produce: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true
): Promise<Cached<T>> {
  const backend = getCacheBackend();

  const cached = await backend.read(key);
  if (cached !== undefined) {
    return { ...(JSON.parse(cached) as object), cacheStatus: 'HIT' } as Cached<T>;
  }

  const fresh = await produce();
  if (shouldCache(fresh)) {
    await backend.write(key, JSON.stringify(fresh), ttl);
  }
  return { ...(fresh as object), cacheStatus: 'MISS' } as Cached<T>;
}
