// GET /api/channels — ports app/api/channels/route.ts onto the TanStack Start worker
// (workerd). Returns the full set of Farcaster channels from Neynar.
//
// Faithful port of the Next route:
//   - Neynar: v1 string constructor `new NeynarAPIClient(apiKey)` (the EXACT call the
//     live route makes) — proven on workerd under nodejs_compat. Reads the key INSIDE the
//     handler via getNeynarApiKey() (module-scope env reads are undefined on workerd).
//   - Cache: replaces next/cache `unstable_cache(['all-channels'], { revalidate: 7200 })`
//     with withCacheAPI(key, 7200, produce). NEVER caches a failed/empty response.
//   - Timeout: same 19s race -> 408 on timeout.
//   - Errors: same status codes + JSON `{ error }` shape as the Next route, so the
//     client provider (`src/lib/farcaster/providers/neynar.ts` -> `{ channels }`) is
//     unaffected. `cacheStatus` is the seam's additive field; we strip it before responding.

import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19s timeout to stay under the original 20s budget
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

class FetchError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

async function fetchAllChannelsUncached(): Promise<any> {
  const apiKey = getNeynarApiKey();
  if (!apiKey) {
    throw new FetchError('API key not configured', 500);
  }

  const neynarClient = new NeynarAPIClient(apiKey);

  const response = await Promise.race([
    neynarClient.fetchAllChannels(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
  ]);

  return response;
}

export const Route = createFileRoute('/api/channels')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // unstable_cache(['all-channels'], { revalidate: 7200 }) -> withCacheAPI.
          // Only cache a non-empty channel set (never cache failed/empty).
          const cached = await withCacheAPI(
            'all-channels',
            7200, // 2 hours
            () => fetchAllChannelsUncached(),
            (value: any) => Array.isArray(value?.channels) && value.channels.length > 0
          );
          // Strip the seam's additive `cacheStatus` so the wire shape matches the
          // source EXACTLY (raw Neynar `{ channels }`), like the other ported routes.
          const { cacheStatus: _cacheStatus, ...response } = cached;
          return Response.json(response);
        } catch (error: any) {
          if (error instanceof FetchError) {
            return Response.json({ error: error.message }, { status: error.statusCode });
          }

          if (error?.message === 'AbortError' || error?.name === 'AbortError') {
            return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
          }

          console.error('Error fetching all channels:', error);

          // Handle Neynar SDK errors
          if (error?.response) {
            return Response.json(
              { error: error.response.data?.message || 'External API error' },
              { status: error.response.status }
            );
          }

          return Response.json({ error: 'Failed to fetch channels' }, { status: 500 });
        }
      },
    },
  },
});
