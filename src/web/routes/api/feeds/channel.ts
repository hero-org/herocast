// SERVER-ONLY route. Ports app/api/feeds/channel/route.ts onto workerd.
//   Neynar: @neynar/nodejs-sdk v1 string constructor `new NeynarAPIClient(apiKey)` —
//           the EXACT call herocast's channel route makes. Proven to run on workerd
//           under nodejs_compat (axios picks its node:http adapter because `process`
//           exists), same as trending.server.ts.
//   Cache:  the live Next route uses an in-memory Map+TTL (2-min). Ported onto the
//           shared edge-cache seam `withCacheAPI` (TTL 120s), keyed identically. Never
//           caches a failed/empty Neynar response (mirrors the "don't pin a transient
//           402/empty for 2 minutes" rule from getTrendingCached).
//
// Read secrets ONLY inside the handler via getNeynarApiKey — `cloudflare:workers` env
// is undefined at module scope on workerd.

import { FeedType, FilterType, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

const getCacheKey = (parentUrl: string, fid: number, limit: number, cursor?: string) =>
  `channel:${parentUrl}:${fid}:${limit}:${cursor || 'initial'}`;

type ChannelFeed = { casts: unknown[]; next: unknown };

export const Route = createFileRoute('/api/feeds/channel')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const parentUrl = searchParams.get('parent_url');
          const fidParam = searchParams.get('fid');
          const limitParam = searchParams.get('limit');
          const cursor = searchParams.get('cursor');

          if (!parentUrl) {
            return Response.json({ error: 'Missing parent_url parameter' }, { status: 400 });
          }

          if (!fidParam) {
            return Response.json({ error: 'Missing fid parameter' }, { status: 400 });
          }

          const fid = parseInt(fidParam, 10);
          const limit = limitParam ? parseInt(limitParam, 10) : 15;

          if (isNaN(fid)) {
            return Response.json({ error: 'Invalid fid parameter' }, { status: 400 });
          }

          if (isNaN(limit) || limit < 1 || limit > 100) {
            return Response.json({ error: 'Invalid limit parameter (1-100)' }, { status: 400 });
          }

          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Decode parent_url if it's URL encoded
          const decodedParentUrl = decodeURIComponent(parentUrl);

          const cacheKey = getCacheKey(decodedParentUrl, fid, limit, cursor || undefined);

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const cached = await withCacheAPI<ChannelFeed>(
              cacheKey,
              120, // 2 minutes, mirrors the live route's CACHE_TTL
              async () => {
                // Initialize Neynar client
                const neynarClient = new NeynarAPIClient(apiKey);

                const options: any = {
                  filterType: FilterType.ParentUrl,
                  parentUrl: decodedParentUrl,
                  fid,
                  limit,
                };

                if (cursor) {
                  options.cursor = cursor;
                }

                const response = await neynarClient.fetchFeed(FeedType.Filter, options);

                // Normalize response
                return {
                  casts: response.casts || [],
                  next: response.next || {},
                };
              },
              // Never cache a failed/empty feed (the produce throws on error, so this
              // only guards the empty-success case).
              (r) => Array.isArray(r.casts) && r.casts.length > 0
            );

            clearTimeout(timeoutId);

            // Strip the cache seam's `cacheStatus` marker so the SUCCESS JSON shape
            // matches the live route exactly — the client provider parses `{ casts, next }`.
            const normalizedResponse: ChannelFeed = { casts: cached.casts, next: cached.next };

            return Response.json(normalizedResponse);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching channel feed:', error);

            if (error.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: 'Failed to fetch channel feed' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in channel feed route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
