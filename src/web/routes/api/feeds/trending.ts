// Migration unit #10 — ports app/api/feeds/trending/route.ts onto the TanStack Start
// worker (Cloudflare/workerd). In-place migration: the live Next route is untouched.
//
// Faithful port of the source GET handler:
//   - same query params + defaults (`limit` default 10, validated 1-100; optional `cursor`)
//   - same validation + error responses (status + JSON `{ error }` shape)
//   - same SUCCESS shape `{ casts, next }` (the client provider parses this exact shape)
//   - same Neynar call: v1 string constructor `new NeynarAPIClient(apiKey).fetchTrendingFeed`
//     (kept — works on workerd under nodejs_compat)
//   - same timeout/abort semantics (19s -> 408) and upstream error proxying
//
// Differences from the Next source (mechanical only):
//   - NextRequest -> Web `request`; NextResponse.json -> Response.json
//   - the source's hand-rolled in-memory Map cache (key `trending:<limit>:<cursor|initial>`,
//     2-min TTL) is replaced by the shared `withCacheAPI` seam (Cloudflare Cache API on
//     workerd, in-process Map+TTL on Node/Vercel) with the SAME key + 120s TTL. We never
//     cache a failed/empty result so a transient upstream error isn't pinned for 2 minutes.
//   - the Neynar key is read via `getNeynarApiKey()` (Worker secret) INSIDE the handler.
//   - `export const maxDuration` dropped (Vercel-only).

import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const CACHE_TTL_SECONDS = 2 * 60; // 2 minutes — mirrors the source route's CACHE_TTL

const getCacheKey = (limit: number, cursor?: string) => `trending:${limit}:${cursor || 'initial'}`;

// Simple server-side timing helper (faithful to the source).
const logTiming = (label: string, startTime: number, metadata?: Record<string, unknown>) => {
  const duration = Date.now() - startTime;
  const status = duration < 1000 ? 'good' : duration < 2000 ? 'warning' : 'critical';
  const icon = status === 'good' ? '⚡' : status === 'warning' ? '⚠️' : '🐌';
  console.log(`${icon} [API] ${label}: ${duration}ms`, metadata || '');
  return duration;
};

type NormalizedTrending = { casts: unknown[]; next: unknown };

export const Route = createFileRoute('/api/feeds/trending')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const limitParam = searchParams.get('limit');
          const cursor = searchParams.get('cursor');

          const limit = limitParam ? parseInt(limitParam, 10) : 10;

          if (isNaN(limit) || limit < 1 || limit > 100) {
            return Response.json({ error: 'Invalid limit parameter (1-100)' }, { status: 400 });
          }

          // Read the secret inside the handler — never at module scope (undefined on workerd).
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          const cacheKey = getCacheKey(limit, cursor || undefined);

          try {
            // withCacheAPI returns a HIT from cache when fresh, else runs `produce`.
            // Only a successful, non-empty response is cached (shouldCache veto) so a
            // transient upstream error is never pinned for the TTL.
            const cached = await withCacheAPI<NormalizedTrending>(
              cacheKey,
              CACHE_TTL_SECONDS,
              async () => {
                // Initialize Neynar client (v1 string constructor — same as the source).
                const neynarClient = new NeynarAPIClient(apiKey);

                // Set up timeout (faithful to the source).
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

                try {
                  const options: { limit: number; cursor?: string } = { limit };
                  if (cursor) {
                    options.cursor = cursor;
                  }

                  const neynarStart = Date.now();
                  const response = await neynarClient.fetchTrendingFeed(options);
                  logTiming('neynar:fetchTrendingFeed', neynarStart, { limit, hasCursor: !!cursor });

                  clearTimeout(timeoutId);

                  // Normalize response (same shape the client provider parses).
                  return {
                    casts: response.casts || [],
                    next: response.next || {},
                  } satisfies NormalizedTrending;
                } finally {
                  clearTimeout(timeoutId);
                }
              },
              // Never cache a failed/empty result.
              (value) => Array.isArray(value.casts) && value.casts.length > 0
            );

            // Strip the cacheStatus marker so the response shape matches the source exactly.
            const { cacheStatus: _cacheStatus, ...normalizedResponse } = cached;
            return Response.json(normalizedResponse);
          } catch (error: any) {
            if (error?.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching trending feed:', error);

            if (error?.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: 'Failed to fetch trending feed' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in trending feed route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
