// GET /api/users/search — faithful port of app/api/users/search/route.ts onto workerd.
//   Neynar: @neynar/nodejs-sdk v1 string constructor `new NeynarAPIClient(apiKey)` —
//           the EXACT call the source makes (proven to run on workerd under nodejs_compat).
//   Cache:  the source wraps the fetch in next/cache `unstable_cache` (revalidate 300s,
//           keyed by `users-search-${q}-${viewerFid}-${limit}`), caching only the
//           `{ users }` shape on success. unstable_cache caches whatever the producer
//           returns and never runs the producer's `catch` to completion on throw, so an
//           error path was never cached. That ports onto the shared edge-cache seam
//           (`withCacheAPI`, TTL 300s, equivalent key). We additionally veto caching an
//           empty `{ users: [] }` so a transient Neynar failure that drains `users` to
//           empty is not pinned for 5 minutes, matching the trending/active port policy.
//           Never cache failed results.
//
// The success JSON shape the client parses is EXACTLY `{ users }`; `withCacheAPI` decorates
// its return with a `cacheStatus` field, so we strip it before responding to avoid shape drift.
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const CACHE_TTL_SECONDS = 300; // 5 minutes — mirrors the source's unstable_cache revalidate

const getCacheKey = (query: string, viewerFid: number, limit: number) => `users-search-${query}-${viewerFid}-${limit}`;

async function searchUsersUncached(apiKey: string, query: string, viewerFid: number, limit: number) {
  // Set up timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const neynarClient = new NeynarAPIClient(apiKey);

    const response = await Promise.race([
      neynarClient.searchUser(query, viewerFid, { limit }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
    ]);

    clearTimeout(timeoutId);

    // Extract users array from response
    const users = (response as any)?.result?.users || [];

    return { users };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.message === 'AbortError' || error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    // Handle Neynar SDK errors
    if (error.response) {
      const apiError = new Error(error.response.data?.message || 'External API error');
      (apiError as any).status = error.response.status;
      throw apiError;
    }

    throw error;
  }
}

export const Route = createFileRoute('/api/users/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const query = searchParams.get('q');
          const viewerFid = searchParams.get('viewer_fid');
          const limit = searchParams.get('limit') || '10';

          if (!query) {
            return Response.json({ error: 'Missing q parameter' }, { status: 400 });
          }

          if (!viewerFid) {
            return Response.json({ error: 'Missing viewer_fid parameter' }, { status: 400 });
          }

          // Validate viewer_fid
          const viewerFidNum = parseInt(viewerFid, 10);
          if (isNaN(viewerFidNum) || viewerFidNum <= 0) {
            return Response.json({ error: 'Invalid viewer_fid' }, { status: 400 });
          }

          // Validate limit
          const limitNum = parseInt(limit, 10);
          if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
            return Response.json({ error: 'Invalid limit (must be 1-100)' }, { status: 400 });
          }

          // Read the secret inside the handler — never at module scope on workerd.
          // Mirrors the source's `API key not configured` 500 (the source threw this from
          // within the cached fetch; here we check up front for the same observable result).
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          const result = await withCacheAPI(
            getCacheKey(query, viewerFidNum, limitNum),
            CACHE_TTL_SECONDS,
            () => searchUsersUncached(apiKey, query, viewerFidNum, limitNum),
            // Never cache an empty (failed/degraded) result — only a genuinely populated list.
            (value) => Array.isArray(value.users) && value.users.length > 0
          );

          // Strip the cache-status decoration so the success shape stays EXACTLY `{ users }`.
          const { cacheStatus: _cacheStatus, ...responseData } = result;
          return Response.json(responseData);
        } catch (error: any) {
          console.error('Error searching users:', error);

          // Handle timeout errors
          if (error.message === TIMEOUT_ERROR_MESSAGE) {
            return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
          }

          // Handle API errors with status code
          if (error.status) {
            return Response.json({ error: error.message || 'External API error' }, { status: error.status });
          }

          // Handle API key configuration error
          if (error.message === 'API key not configured') {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          return Response.json({ error: 'Failed to search users' }, { status: 500 });
        }
      },
    },
  },
});
