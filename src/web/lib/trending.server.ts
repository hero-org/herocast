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

// ── Cloudflare Cache API — replaces next/cache `unstable_cache` ──────────────
export type Cached<T> = T & { cacheStatus: 'HIT' | 'MISS' | 'BYPASS' };

// `shouldCache` lets a caller veto caching a particular result (e.g. don't cache a
// failed/empty Neynar response). When omitted, every produced value is cached.
// Returning false yields cacheStatus 'MISS' (fresh, uncached) — never 'BYPASS', which
// is reserved for "no Cache API available".
export async function withCacheAPI<T>(
  key: string,
  ttl: number,
  produce: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true
): Promise<Cached<T>> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(`https://herocast-cache.internal/${encodeURIComponent(key)}`);

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const data = (await hit.json()) as T;
      return { ...(data as object), cacheStatus: 'HIT' } as Cached<T>;
    }
  }

  const fresh = await produce();

  if (cache && shouldCache(fresh)) {
    // Cache-Control max-age drives the TTL — mirrors the trending route's 2-min window.
    // The Cache API has NO tag invalidation; max-age is the only lever.
    const resp = new Response(JSON.stringify(fresh), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${ttl}`,
      },
    });
    await cache.put(cacheKey, resp);
    return { ...(fresh as object), cacheStatus: 'MISS' } as Cached<T>;
  }

  return { ...(fresh as object), cacheStatus: cache ? 'MISS' : 'BYPASS' } as Cached<T>;
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
