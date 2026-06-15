import { CastParamType, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/casts/lookup — ported from app/api/casts/lookup/route.ts (Next).
// Faithful port: same query params + defaults, same validation, same error
// responses (status + JSON shape), same SUCCESS JSON shape (raw Neynar response).
//
// Caching: the source uses its OWN in-memory Map+TTL (NOT next/cache
// `unstable_cache`), so per the migration rules we port that cache verbatim rather
// than swapping in withCacheAPI (which would add a `cacheStatus` field and drift the
// success shape the client provider parses). On workerd the Map is per-instance /
// ephemeral — same semantics as the live Next route's in-memory cache.
//
// `export const maxDuration = 20` (Vercel-only) is intentionally dropped.

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

// In-memory cache for cast lookups (5 minute TTL)
const lookupCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (identifier: string, type: string, viewerFid?: string) =>
  `${identifier}:${type}:${viewerFid || 'no-viewer'}`;

const getCachedData = (key: string) => {
  const cached = lookupCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    lookupCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: unknown) => {
  lookupCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (lookupCache.size > 1000) {
    const now = Date.now();
    const entries = Array.from(lookupCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        lookupCache.delete(k);
      }
    }
  }
};

export const Route = createFileRoute('/api/casts/lookup')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const identifier = searchParams.get('identifier');
          const type = searchParams.get('type');
          const viewerFid = searchParams.get('viewer_fid');

          if (!identifier) {
            return Response.json({ error: 'Missing identifier parameter' }, { status: 400 });
          }

          if (!type || (type !== 'hash' && type !== 'url')) {
            return Response.json({ error: 'Invalid type parameter. Must be "hash" or "url"' }, { status: 400 });
          }

          // Read the secret inside the handler (workerd: module-scope env is undefined).
          const API_KEY = getNeynarApiKey();
          if (!API_KEY) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Check cache first
          const cacheKey = getCacheKey(identifier, type, viewerFid || undefined);
          const cachedData = getCachedData(cacheKey);
          if (cachedData) {
            return Response.json(cachedData);
          }

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const neynarClient = new NeynarAPIClient(API_KEY);

            const castParamType = type === 'hash' ? CastParamType.Hash : CastParamType.Url;

            // Note: viewerFid is no longer supported in the Neynar SDK for this endpoint
            const response = await Promise.race([
              neynarClient.lookUpCastByHashOrWarpcastUrl(identifier, castParamType),
              new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
            ]);

            clearTimeout(timeoutId);

            // Cache the response
            setCachedData(cacheKey, response);

            return Response.json(response);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.message === 'AbortError' || error.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error looking up cast:', error);

            // Handle Neynar SDK errors
            if (error.response) {
              return Response.json(
                { error: error.response.data?.message || 'External API error' },
                { status: error.response.status }
              );
            }

            return Response.json({ error: 'Failed to lookup cast' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in casts lookup route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
