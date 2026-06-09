// SERVER-ONLY (`.server.ts`). Ports app/api/feeds/trending/route.ts onto workerd.
//   Path A: @neynar/nodejs-sdk v1 string constructor `new NeynarAPIClient(apiKey)`
//           — the EXACT call herocast makes in app/api/feeds/trending/route.ts.
//           Proven to run on workerd under nodejs_compat (axios picks its node:http
//           adapter because `process` exists).
//   Path B: inline Neynar REST over native fetch — proven, but stays UNUSED while
//           the SDK path works. Kept as a deliberate, documented fallback.
//   Cache:  replaces next/cache `unstable_cache` with the Cloudflare Cache API. TTL is
//           carried ONLY on Cache-Control: max-age (the Cache API has no tag invalidation).
//
// The `.server.ts` filename is LOAD-BEARING: this module imports the node-only Neynar
// SDK and `@/web/lib/neynar.server` (→ `@/web/lib/env.server` → `cloudflare:workers`),
// all denied in the client. Keeping the implementation here — separate from the
// client-importable server-fn wrapper in `trending.ts` — means the default client
// deny-rule (`**/*.server.*`) mocks this whole module out of the client bundle
// DETERMINISTICALLY. (When this logic lived inline in the server-fn module, its exported
// helpers held the denied `neynar.server` import alive in the client chunk and the build
// failed.)
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// ── Neynar fetch — Path A (SDK) and Path B (REST fallback) ───────────────────

type TrendingCasts = { casts: unknown[]; next: unknown };

// Path A — the production SDK, used EXACTLY as herocast does (v1 string constructor).
export async function fetchTrendingViaSDK(apiKey: string, limit: number, cursor?: string): Promise<TrendingCasts> {
  const client = new NeynarAPIClient(apiKey);
  const options: { limit: number; cursor?: string } = { limit };
  if (cursor) options.cursor = cursor;
  const res = await client.fetchTrendingFeed(options);
  return { casts: res?.casts ?? [], next: res?.next ?? {} };
}

// Path B (fallback) — inline Neynar REST over native fetch. No axios, no node builtins.
export async function fetchTrendingViaREST(apiKey: string, limit: number, cursor?: string): Promise<TrendingCasts> {
  const url = new URL('https://api.neynar.com/v2/farcaster/feed/trending');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  const r = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Neynar REST ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = (await r.json()) as { casts?: unknown[]; next?: unknown };
  return { casts: data?.casts ?? [], next: data?.next ?? {} };
}

export type TrendingResult = {
  source: 'neynar-sdk' | 'neynar-rest';
  casts: unknown[];
  next: unknown;
  sdkError: string | null; // populated when the SDK path threw and we fell back
  fetchedAt: string;
};

// Try the SDK first (the production path), fall back to REST. Record which path won
// and the exact SDK error so the slice is self-documenting.
export async function fetchTrending(limit: number, cursor?: string): Promise<TrendingResult> {
  const apiKey = getNeynarApiKey();
  // Forkability: no key -> empty result, never a throw (the probe renders an empty state).
  if (!apiKey) {
    return { source: 'neynar-rest', casts: [], next: {}, sdkError: null, fetchedAt: new Date().toISOString() };
  }

  let sdkError: string | null = null;
  try {
    const r = await fetchTrendingViaSDK(apiKey, limit, cursor);
    return { source: 'neynar-sdk', casts: r.casts, next: r.next, sdkError: null, fetchedAt: new Date().toISOString() };
  } catch (e: unknown) {
    sdkError = String((e as { stack?: string; message?: string })?.stack ?? (e as Error)?.message ?? e).slice(0, 800);
  }
  // REST fallback. Wrapped so a Neynar failure (over-quota 402, network error, etc.)
  // degrades to the empty state with the error surfaced in `sdkError` — the field the
  // probe already renders — rather than throwing and 500-ing the SSR render. This keeps
  // the probe "self-documenting, never crashes" even when a real-but-failing key is set
  // (a bare key with no quota is effectively the same forkability case as no key).
  try {
    const r = await fetchTrendingViaREST(apiKey, limit, cursor);
    return { source: 'neynar-rest', casts: r.casts, next: r.next, sdkError, fetchedAt: new Date().toISOString() };
  } catch (e: unknown) {
    const restError = String((e as { stack?: string; message?: string })?.stack ?? (e as Error)?.message ?? e).slice(
      0,
      800
    );
    const combinedError = sdkError ? `${sdkError}\n--- REST fallback also failed ---\n${restError}` : restError;
    return { source: 'neynar-rest', casts: [], next: {}, sdkError: combinedError, fetchedAt: new Date().toISOString() };
  }
}

// ── Edge cache — replaces next/cache `unstable_cache`. HOST-PORTABLE behind a tiny
// CacheBackend: Cloudflare's Cache API where available (caches.default), else an
// in-process Map+TTL (Node/Vercel) that mirrors the live Next trending route's in-memory
// cache. This is the seam the 12 `unstable_cache` sites port onto in Phase 3.
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

// key `trending:<limit>`, TTL 120s — mirrors prod's 2-min CACHE_TTL.
// Do NOT cache a failed/empty result: an over-quota 402 (or any error that drains
// `casts` to empty) must not be pinned for 120s — otherwise fixing the key still
// shows empty until the TTL expires, and in prod a transient 402 would be served
// stale for 2 minutes. Only cache a genuinely successful, non-empty feed.
export function getTrendingCached(limit: number): Promise<Cached<TrendingResult>> {
  return withCacheAPI(
    `trending:${limit}`,
    120,
    () => fetchTrending(limit),
    (r) => r.sdkError === null && r.casts.length > 0
  );
}

// The fn boundary serializes its return across SSR, so the response must be made of
// concrete serializable primitives — not the raw `unknown[]` casts (TanStack's strict
// serializer rejects `unknown`). Normalize each cast to the minimal renderable shape.
export type SerializableCast = {
  hash: string;
  text: string;
  author: { username: string; displayName: string };
};

export function toSerializableCast(c: unknown): SerializableCast {
  const cast = (c ?? {}) as {
    hash?: unknown;
    text?: unknown;
    author?: { username?: unknown; display_name?: unknown };
  };
  return {
    hash: String(cast.hash ?? ''),
    text: String(cast.text ?? ''),
    author: {
      username: String(cast.author?.username ?? ''),
      displayName: String(cast.author?.display_name ?? ''),
    },
  };
}
