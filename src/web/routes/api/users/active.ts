// GET /api/users/active — faithful port of app/api/users/active/route.ts onto workerd.
//   Neynar: @neynar/nodejs-sdk v1 string constructor `new NeynarAPIClient(apiKey)` —
//           the EXACT call the source makes (proven to run on workerd under nodejs_compat).
//   Cache:  the source uses a hand-rolled in-memory Map with a 5-minute TTL keyed by
//           `active:<limit>`, caching only the `{ users }` shape. That ports onto the
//           shared edge-cache seam (`withCacheAPI`, TTL 300s, same key). The source never
//           cached an error path (it only reached `setCachedData` on success), but it DID
//           cache an empty `{ users: [] }` — we additionally veto caching empty results so
//           a transient Neynar failure that drains `users` to empty is not pinned for 5
//           minutes, matching the trending port's policy. Never cache failed results.
//
// The success JSON shape the client parses is EXACTLY `{ users }`; `withCacheAPI` decorates
// its return with a `cacheStatus` field, so we strip it before responding to avoid shape drift.
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes — mirrors the source's CACHE_TTL

const getCacheKey = (limit: number) => `active:${limit}`;

export const Route = createFileRoute('/api/users/active')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const limitParam = searchParams.get('limit') || '14';

          // Read the secret inside the handler — never at module scope on workerd.
          const API_KEY = getNeynarApiKey();
          if (!API_KEY) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Validate limit
          const limit = parseInt(limitParam, 10);
          if (isNaN(limit) || limit <= 0 || limit > 100) {
            return Response.json({ error: 'Invalid limit (must be 1-100)' }, { status: 400 });
          }

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const result = await withCacheAPI(
              getCacheKey(limit),
              CACHE_TTL_SECONDS,
              async () => {
                const neynarClient = new NeynarAPIClient(API_KEY);

                const response = await Promise.race([
                  neynarClient.fetchActiveUsers({ limit }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
                ]);

                // Extract users array from response
                const users = (response as any)?.users || [];

                return { users };
              },
              // Never cache an empty (failed/degraded) result — only a genuinely populated feed.
              (value) => Array.isArray(value.users) && value.users.length > 0
            );

            clearTimeout(timeoutId);

            // Strip the cache-status decoration so the success shape stays EXACTLY `{ users }`.
            const { cacheStatus: _cacheStatus, ...responseData } = result;
            return Response.json(responseData);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.message === 'AbortError' || error.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching active users:', error);

            // Handle Neynar SDK errors
            if (error.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: 'Failed to fetch active users' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in active users route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
