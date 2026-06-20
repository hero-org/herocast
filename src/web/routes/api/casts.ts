import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/casts — ported from app/api/casts/route.ts onto workerd.
// Proxies Neynar's /v2/farcaster/casts endpoint (REST). Faithful port:
// same query params + defaults, same validation, same error shapes/statuses, and the
// raw upstream JSON as the success body (the client provider reads `data.result.casts`).
//
// Caching: the Next source wrapped the upstream fetch in next/cache `unstable_cache`
// (key `casts-<casts>-<viewerFid>`, revalidate 600s). That ports onto the shared edge
// cache seam `withCacheAPI(key, ttlSeconds, produce, shouldCache)`. A failed/empty
// result is NEVER cached: only a successful response with a non-empty `result.casts`
// is pinned, so a transient error or empty page can't be served stale for 10 minutes.
// `withCacheAPI` spreads a `cacheStatus` field onto the body; the client only reads
// `data.result.casts`, so this is additive and does not break the parsed shape
// (mirrors the canonical getTrendingCached usage in trending.server.ts).
//
// Secrets are read INSIDE the handler via getNeynarApiKey() — module-scope
// `cloudflare:workers` env reads are undefined on workerd.

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/casts';

type CastsResponse = { result?: { casts?: unknown[] } };

async function fetchCastsUncached(apiKey: string, casts: string, viewerFid: number | null): Promise<CastsResponse> {
  // Create params for Neynar API
  const params = new URLSearchParams();
  params.append('casts', casts);
  if (viewerFid !== null) {
    params.append('viewer_fid', viewerFid.toString());
  }

  // Set up timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const response = await fetch(`${NEYNAR_API_URL}?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        api_key: apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let message = 'External API error';
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody?.message) {
          message = errorBody.message;
        }
      } catch {
        // Non-JSON error body — fall back to the generic message above.
      }
      const apiError = new Error(message);
      (apiError as { status?: number }).status = response.status;
      throw apiError;
    }

    return (await response.json()) as CastsResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error?.name === 'AbortError') {
      const timeoutError = new Error(TIMEOUT_ERROR_MESSAGE);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }

    throw error;
  }
}

export const Route = createFileRoute('/api/casts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const casts = searchParams.get('casts');
          const viewerFid = searchParams.get('viewer_fid');

          if (!casts) {
            return Response.json({ error: 'Missing casts parameter' }, { status: 400 });
          }

          // Parse viewer_fid to number or null
          const viewerFidNum = viewerFid ? parseInt(viewerFid, 10) : null;
          if (viewerFid && (isNaN(viewerFidNum!) || viewerFidNum! <= 0)) {
            return Response.json({ error: 'Invalid viewer_fid format' }, { status: 400 });
          }

          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // unstable_cache port: key `casts:<casts>:<viewerFid|anon>`, TTL 600s. Only
          // cache a successful, non-empty result so errors/empty pages are not pinned.
          const data = await withCacheAPI<CastsResponse>(
            `casts:${casts}:${viewerFidNum ?? 'anon'}`,
            600,
            () => fetchCastsUncached(apiKey, casts, viewerFidNum),
            (value) => (value?.result?.casts?.length ?? 0) > 0
          );
          return Response.json(data);
        } catch (error: any) {
          console.error('Error fetching casts:', error);

          // Handle timeout errors
          if (error?.name === 'TimeoutError' || error?.message === TIMEOUT_ERROR_MESSAGE) {
            return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
          }

          // Handle API errors with status
          if (error?.status) {
            return Response.json({ error: error.message || 'External API error' }, { status: error.status });
          }

          return Response.json({ error: 'Failed to fetch casts' }, { status: 500 });
        }
      },
    },
  },
});
