// GET /api/feeds/profile — ports app/api/feeds/profile/route.ts onto workerd.
//   Migration unit #10. The live Next route is untouched; this is the in-place TanStack
//   Start twin. The client provider parses the EXACT success shape `{ casts, next }`, so
//   the success JSON must stay byte-for-byte compatible with the Next route.
//
//   Neynar: keeps the v1 string constructor `new NeynarAPIClient(apiKey)` for the SDK
//   branches. The two no-SDK-helper feeds (popular / replies_and_recasts) hit the Neynar
//   v2 REST endpoint via NATIVE fetch — NOT axios: axios's node build pulls follow-redirects
//   -> debug -> supports-color -> `node:tty`, which workerd cannot load (it 500s the whole
//   worker at init). The REST error branch re-throws an axios-shaped `{ response }` so error
//   parity with the source is preserved.
//
//   Cache: the source uses a per-instance in-memory Map with a 2-minute TTL keyed
//   `profile:<fid>:<type>:<limit>:<cursor|'initial'>`. That ports onto `withCacheAPI`
//   (the canonical edge-cache seam, which mirrors the same Map+TTL semantics on Node and
//   uses the Cloudflare Cache API on workerd). We keep the same key shape and 120s TTL,
//   and — like getTrendingCached — never cache a failed/empty result so a transient
//   over-quota / error response is not pinned for the TTL.
import { FeedType, FilterType, NeynarAPIClient, ReactionsType } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds, mirrors the source (Vercel maxDuration dropped)
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

const VALID_TYPES = ['casts', 'likes', 'replies_and_recasts', 'popular'] as const;

const CACHE_TTL_SECONDS = 2 * 60; // 2 minutes — mirrors the source's 2-min CACHE_TTL.

const getCacheKey = (fid: number, type: string, limit: number, cursor?: string) =>
  `profile:${fid}:${type}:${limit}:${cursor || 'initial'}`;

type NormalizedResponse = { casts: unknown[]; next: unknown };

export const Route = createFileRoute('/api/feeds/profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const fidParam = searchParams.get('fid');
          const type = searchParams.get('type');
          const limitParam = searchParams.get('limit');
          const cursor = searchParams.get('cursor');

          if (!fidParam) {
            return Response.json({ error: 'Missing fid parameter' }, { status: 400 });
          }

          if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
            return Response.json(
              { error: `Invalid type parameter (must be one of: ${VALID_TYPES.join(', ')})` },
              { status: 400 }
            );
          }

          const fid = parseInt(fidParam, 10);
          const limit = limitParam ? parseInt(limitParam, 10) : 25;

          if (isNaN(fid)) {
            return Response.json({ error: 'Invalid fid parameter' }, { status: 400 });
          }

          if (isNaN(limit) || limit < 1 || limit > 100) {
            return Response.json({ error: 'Invalid limit parameter (1-100)' }, { status: 400 });
          }

          // Read the secret inside the handler — module-scope `cloudflare:workers` reads
          // are undefined on workerd.
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Set up timeout (only the axios REST path honors the signal, matching source).
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const cacheKey = getCacheKey(fid, type, limit, cursor || undefined);

            // Replaces the source's in-memory Map with the canonical edge-cache seam.
            // Same key + 2-min TTL. `shouldCache` vetoes empty results so a failed/empty
            // Neynar response is never pinned for the TTL (matches getTrendingCached).
            const cached = await withCacheAPI<NormalizedResponse>(
              cacheKey,
              CACHE_TTL_SECONDS,
              async () => {
                let normalizedResponse: NormalizedResponse;

                if (type === 'casts') {
                  // Fetch user's casts using feed with FilterType.Fids
                  const options: any = {
                    filterType: FilterType.Fids,
                    fids: [fid],
                    limit,
                  };

                  if (cursor) {
                    options.cursor = cursor;
                  }

                  const neynarClient = new NeynarAPIClient(apiKey);
                  const response = await neynarClient.fetchFeed(FeedType.Filter, options);

                  normalizedResponse = {
                    casts: response.casts || [],
                    next: response.next || {},
                  };
                } else if (type === 'likes') {
                  // Fetch user's likes/reactions
                  const options: any = { limit };

                  if (cursor) {
                    options.cursor = cursor;
                  }

                  const neynarClient = new NeynarAPIClient(apiKey);
                  const response = await neynarClient.fetchUserReactions(fid, ReactionsType.Likes, options);

                  normalizedResponse = {
                    casts: response.reactions.map(({ cast }) => cast),
                    next: response.next || {},
                  };
                } else {
                  // replies_and_recasts / popular — no SDK helper, call the v2 feed endpoints directly.
                  const path = type === 'popular' ? 'feed/user/popular' : 'feed/user/replies_and_recasts';
                  const params = new URLSearchParams({ fid: String(fid), limit: String(limit) });
                  if (cursor) {
                    params.append('cursor', cursor);
                  }

                  // Native fetch (NOT axios): axios's node build pulls follow-redirects ->
                  // debug -> supports-color -> `node:tty`, which workerd cannot load. On a
                  // non-2xx we re-throw an axios-shaped `{ response: { status, data } }` so the
                  // catch block's `error.response` branch keeps the SAME error parity.
                  const httpRes = await fetch(`https://api.neynar.com/v2/farcaster/${path}?${params.toString()}`, {
                    headers: {
                      accept: 'application/json',
                      api_key: apiKey,
                    },
                    signal: controller.signal,
                  });
                  if (!httpRes.ok) {
                    const data = await httpRes.json().catch(() => ({}));
                    throw { response: { status: httpRes.status, data } };
                  }
                  const data = (await httpRes.json()) as { casts?: unknown[]; next?: unknown };

                  normalizedResponse = {
                    casts: data?.casts || [],
                    next: data?.next || {},
                  };
                }

                return normalizedResponse;
              },
              // Never cache a failed/empty result — only a genuinely populated feed.
              (r) => Array.isArray(r.casts) && r.casts.length > 0
            );

            clearTimeout(timeoutId);

            // Strip the seam's `cacheStatus` so the success shape stays EXACTLY `{ casts, next }`
            // (the client provider parses this exact shape).
            return Response.json({ casts: cached.casts, next: cached.next });
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error(`Error fetching profile ${type} feed:`, error);

            if (error.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: `Failed to fetch profile ${type} feed` }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in profile feed route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
