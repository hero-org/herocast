// SERVER-ONLY route handler. Ports app/api/casts/conversation/route.ts onto workerd.
//
// Faithful port of the Next data route: same query params + defaults, same validation,
// same error responses (status + JSON error shape), same SUCCESS JSON shape (the raw
// Neynar `/v2/farcaster/cast/conversation` payload — the client provider parses this
// exact shape).
//
// Neynar: the source makes a direct REST call (not the SDK) because it needs the
//   `fold` / `sort_type` quality-filtering params the SDK doesn't expose yet — kept REST.
//   The key is resolved at REQUEST time via getNeynarApiKey() (mirrors the source's
//   `process.env.NEXT_PUBLIC_NEYNAR_API_KEY`); the un-prefixed Worker secret takes
//   precedence. Never read at module scope (workerd) and never echoed.
// Cache: the source uses a custom in-memory Map+TTL (5 min) keyed on the request
//   params. That is exactly the seam withCacheAPI() provides (Cloudflare Cache API on
//   workerd, in-process Map+TTL on Node), so we port onto it. `cacheStatus` is stripped
//   from the body before returning so the SUCCESS JSON shape stays byte-identical to the
//   source. We never cache a failed/empty/timeout result.
// maxDuration (Vercel-only) is dropped; the 19s internal timeout is preserved.
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes — mirrors the source's CACHE_TTL

const getCacheKey = (identifier: string, replyDepth: number, includeParents: boolean, viewerFid?: string) =>
  `${identifier}:${replyDepth}:${includeParents}:${viewerFid || 'no-viewer'}`;

export const Route = createFileRoute('/api/casts/conversation')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const identifier = searchParams.get('identifier');
          const replyDepthParam = searchParams.get('reply_depth') || '1';
          const includeParentsParam = searchParams.get('include_chronological_parent_casts') || 'true';
          const viewerFid = searchParams.get('viewer_fid');
          const fold = searchParams.get('fold') || 'above'; // Quality filtering: hide low-quality replies below the fold
          const sortType = searchParams.get('sort_type') || 'algorithmic'; // Rank replies by quality

          if (!identifier) {
            return Response.json({ error: 'Missing identifier parameter' }, { status: 400 });
          }

          const API_KEY = getNeynarApiKey();
          if (!API_KEY) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Parse parameters
          const replyDepth = parseInt(replyDepthParam, 10);
          if (isNaN(replyDepth) || replyDepth < 0 || replyDepth > 5) {
            return Response.json({ error: 'Invalid reply_depth (must be 0-5)' }, { status: 400 });
          }

          const includeParents = includeParentsParam === 'true';

          // Cache key (include fold and sortType) — same composition as the source.
          const cacheKey = `${getCacheKey(identifier, replyDepth, includeParents, viewerFid || undefined)}:${fold}:${sortType}`;

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            // Build query parameters manually since SDK doesn't support fold and sortType yet
            const queryParams = new URLSearchParams({
              identifier,
              type: 'hash',
              reply_depth: replyDepth.toString(),
              include_chronological_parent_casts: includeParents.toString(),
            });

            if (viewerFid) {
              const viewerFidNum = parseInt(viewerFid, 10);
              if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
                queryParams.append('viewer_fid', viewerFidNum.toString());
              }
            }

            // Add quality filtering parameters
            if (fold) {
              queryParams.append('fold', fold);
            }
            if (sortType) {
              queryParams.append('sort_type', sortType);
            }

            // Make direct API call to support new quality filtering parameters
            const apiUrl = `https://api.neynar.com/v2/farcaster/cast/conversation?${queryParams.toString()}`;

            const produce = () =>
              fetch(apiUrl, {
                method: 'GET',
                headers: {
                  accept: 'application/json',
                  api_key: API_KEY,
                  'x-neynar-experimental': 'true', // Enable score-based filtering
                },
                signal: controller.signal,
              }).then(async (res) => {
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}));
                  throw new Error((errorData as { message?: string }).message || `API error: ${res.status}`);
                }
                return res.json();
              });

            const fetchPromise = withCacheAPI(
              cacheKey,
              CACHE_TTL_SECONDS,
              produce,
              // Never cache a failed/empty Neynar response. A non-ok fetch throws inside
              // `produce` (so it never reaches here); this additionally guards against
              // caching a 200 that lacks the `conversation` payload the client expects.
              (value) => Boolean((value as { conversation?: unknown } | null | undefined)?.conversation)
            );

            const response = await Promise.race([
              fetchPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
            ]);

            clearTimeout(timeoutId);

            // Strip the cache seam's marker so the SUCCESS shape is byte-identical to the
            // source (the raw Neynar payload). `cacheStatus` is the only field added by
            // withCacheAPI.
            const { cacheStatus: _cacheStatus, ...body } = response as Record<string, unknown> & {
              cacheStatus?: string;
            };

            return Response.json(body);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.message === 'AbortError' || error.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error looking up cast conversation:', error);

            // Handle API errors
            if (error.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: 'Failed to lookup cast conversation' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in casts conversation route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
