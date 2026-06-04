// ── Q1 + Q2 probe ──────────────────────────────────────────────────────────
// Server-only. Ports app/api/feeds/trending/route.ts onto workerd.
//   Q1: does @neynar/nodejs-sdk@1.21.1 (axios under the hood) run on workerd?
//   Q2: does a replacement for next/cache `unstable_cache` work (CF Cache API)?
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

export type TrendingResult = {
  source: 'neynar-sdk' | 'neynar-rest';
  count: number;
  sample: Array<{ hash: string; author: string; text: string }>;
  sdkError: string | null; // populated when the SDK path threw and we fell back
  fetchedAt: string;
};

function summarize(casts: any[]): TrendingResult['sample'] {
  return (casts || []).slice(0, 5).map((c) => ({
    hash: c?.hash ?? '',
    author: c?.author?.username ?? c?.author?.display_name ?? '',
    text: String(c?.text ?? '').replace(/\s+/g, ' ').slice(0, 100),
  }));
}

// Path A — the production SDK, used EXACTLY as herocast does (v1 string constructor).
export async function fetchTrendingViaSDK(apiKey: string, limit: number, cursor?: string) {
  const client = new NeynarAPIClient(apiKey);
  const options: any = { limit };
  if (cursor) options.cursor = cursor;
  const res = await client.fetchTrendingFeed(options);
  return { casts: res?.casts ?? [], next: res?.next ?? {} };
}

// Path B (fallback) — inline Neynar REST over native fetch. No axios, no node builtins.
export async function fetchTrendingViaREST(apiKey: string, limit: number, cursor?: string) {
  const url = new URL('https://api.neynar.com/v2/farcaster/feed/trending');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  const r = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Neynar REST ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data: any = await r.json();
  return { casts: data?.casts ?? [], next: data?.next ?? {} };
}

// Try the SDK first (the actual unknown), fall back to REST. Record which path won
// and the exact SDK error so the spike output is self-documenting.
export async function fetchTrendingWithFallback(
  apiKey: string,
  limit: number,
  cursor?: string
): Promise<TrendingResult> {
  let sdkError: string | null = null;
  try {
    const r = await fetchTrendingViaSDK(apiKey, limit, cursor);
    return {
      source: 'neynar-sdk',
      count: r.casts.length,
      sample: summarize(r.casts),
      sdkError: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    sdkError = String(e?.stack || e?.message || e).slice(0, 800);
  }
  const r = await fetchTrendingViaREST(apiKey, limit, cursor);
  return {
    source: 'neynar-rest',
    count: r.casts.length,
    sample: summarize(r.casts),
    sdkError,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Q2: unstable_cache replacement via the Cloudflare Cache API ──────────────
export type Cached<T> = T & { cacheStatus: 'HIT' | 'MISS' | 'BYPASS' };

export async function withCacheAPI<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>
): Promise<Cached<T>> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const cacheKey = new Request(`https://spike-cache.internal/${encodeURIComponent(key)}`);

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const data = (await hit.json()) as T;
      return { ...(data as any), cacheStatus: 'HIT' };
    }
  }

  const fresh = await produce();

  if (cache) {
    // Cache-Control max-age drives the TTL, mirroring the trending route's 2-min window.
    const resp = new Response(JSON.stringify(fresh), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${ttlSeconds}`,
      },
    });
    await cache.put(cacheKey, resp);
    return { ...(fresh as any), cacheStatus: 'MISS' };
  }

  return { ...(fresh as any), cacheStatus: 'BYPASS' };
}

export async function getTrendingCached(apiKey: string, limit: number) {
  return withCacheAPI(`trending:${limit}`, 120, () => fetchTrendingWithFallback(apiKey, limit));
}
