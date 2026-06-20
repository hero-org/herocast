// GET /api/feeds/following — TanStack Start worker port of app/api/feeds/following/route.ts.
// Faithful port: same query params + defaults (followingFeedRequestSchema), same validation
// and error responses (status + JSON error shape), same success JSON shape
// (buildFollowingFeedResponse). The client provider parses this exact shape.
//
// Neynar: keeps the v1 string-constructor SDK call the source makes
// (`new NeynarAPIClient(apiKey)` + `fetchUserFollowingFeed`) — runs on workerd under
// nodejs_compat (same path proven by trending.server.ts).
//
// Cache: the source uses a custom in-memory Map+TTL (2 min) keyed by
// `following:<fid>:<limit>:<cursor>`. Ported onto the shared `withCacheAPI` seam, which
// is host-portable (Cloudflare Cache API on workerd, Map+TTL on Node) and carries TTL on
// Cache-Control: max-age. Per the cache rule, never cache a failed/empty result — only a
// successful, non-empty feed is stored (the source's error/timeout paths return before
// caching anyway). `cacheStatus` from the seam is stripped before responding so the wire
// shape matches the source exactly.
//
// Secrets are read ONLY inside the handler via getNeynarApiKey(); never at module scope.

import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import {
  buildFollowingFeedResponse,
  type FollowingFeedResponse,
  followingFeedRequestSchema,
  followingFeedResponseSchemaStrict,
} from '@/lib/api-contracts/feeds-following';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

// Simple server-side timing helper — mirrors the source.
const logTiming = (label: string, startTime: number, metadata?: Record<string, unknown>) => {
  const duration = Date.now() - startTime;
  const status = duration < 1000 ? 'good' : duration < 2000 ? 'warning' : 'critical';
  const icon = status === 'good' ? '⚡' : status === 'warning' ? '⚠️' : '🐌';
  console.log(`${icon} [API] ${label}: ${duration}ms`, metadata || '');
  return duration;
};

const CACHE_TTL_SECONDS = 2 * 60; // 2 minutes — mirrors the source's CACHE_TTL.
const getCacheKey = (fid: number, limit: number, cursor?: string) => `following:${fid}:${limit}:${cursor || 'initial'}`;

export const Route = createFileRoute('/api/feeds/following')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const params = Object.fromEntries(new URL(request.url).searchParams);
          const parsed = followingFeedRequestSchema.safeParse(params);
          if (!parsed.success) {
            return Response.json({ error: 'Invalid params', details: parsed.error.format() }, { status: 400 });
          }
          const { fid, limit, cursor } = parsed.data;

          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Set up timeout — mirrors the source AbortController flow.
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            // Cache the produce() result through the shared seam (HIT/MISS via Cache API or
            // Map). Only successful, non-empty feeds are cached; failures/timeouts throw out
            // of produce() and skip caching entirely.
            const cacheKey = getCacheKey(fid, limit, cursor);
            const cached = await withCacheAPI<FollowingFeedResponse>(
              cacheKey,
              CACHE_TTL_SECONDS,
              async () => {
                const neynarClient = new NeynarAPIClient(apiKey);
                const options: { limit: number; cursor?: string } = { limit };
                if (cursor) {
                  options.cursor = cursor;
                }

                const neynarStart = Date.now();
                const response = await neynarClient.fetchUserFollowingFeed(fid, options);
                logTiming('neynar:fetchUserFollowingFeed', neynarStart, { fid, limit, hasCursor: !!cursor });

                // Normalize response via the pure builder — same function the contract test
                // imports to assert shape parity against the schema.
                const responsePayload = buildFollowingFeedResponse(response);

                // Dev-only response validation: surfaces drift before it ships to clients.
                if (process.env.NODE_ENV !== 'production') {
                  followingFeedResponseSchemaStrict.parse(responsePayload);
                }

                return responsePayload;
              },
              (value) => value.casts.length > 0
            );

            clearTimeout(timeoutId);

            // Strip the seam's cacheStatus so the wire shape matches the source exactly.
            const { cacheStatus: _cacheStatus, ...responsePayload } = cached;
            return Response.json(responsePayload);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching following feed:', error);

            if (error.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: 'Failed to fetch following feed' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in following feed route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
