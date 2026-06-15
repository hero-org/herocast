// SERVER-ONLY route. Ports app/api/channels/search/route.ts onto workerd.
//   GET /api/channels/search?q=<query>
//
// Faithful port of the live Next route:
//   - `q` is required (400 `{ error: 'Missing q parameter' }` when absent).
//   - Query is lowercased before lookup (better cache hits) — same as Next.
//   - Neynar is reached via the v1 string constructor `new NeynarAPIClient(apiKey)`
//     and `searchChannels(query)` — the EXACT call the Next route makes. Proven to
//     run on workerd under nodejs_compat (see trending.server.ts).
//   - A 19s timeout races the Neynar call; on abort we return 408 `{ error: 'Request
//     timed out' }`.
//   - next/cache `unstable_cache` (revalidate 900s, key `channels-search-<q>`) is
//     replaced with `withCacheAPI` (TTL 900s, key `channels-search:<q>`). We NEVER
//     cache a failed/empty result — only a successful, non-empty channel list.
//   - The SUCCESS body is the raw Neynar `searchChannels` response, byte-for-byte
//     compatible with the live route. `withCacheAPI` stamps a `cacheStatus` marker;
//     we strip it before responding so the client-parsed shape does NOT drift.
//
// Secrets (the Neynar key) are read INSIDE the handler via `getNeynarApiKey()` —
// never at module scope (`cloudflare:workers` env is undefined at module scope on
// workerd) and never echoed.

import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds — mirrors the Next route's budget.
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

type ChannelsSearchResponse = { channels?: unknown[] } & Record<string, unknown>;

async function searchChannelsUncached(apiKey: string, query: string): Promise<ChannelsSearchResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const neynarClient = new NeynarAPIClient(apiKey);

    const response = (await Promise.race([
      neynarClient.searchChannels(query),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
    ])) as ChannelsSearchResponse;

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const Route = createFileRoute('/api/channels/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const query = searchParams.get('q');

          if (!query) {
            return Response.json({ error: 'Missing q parameter' }, { status: 400 });
          }

          // Read the secret inside the handler; absent key -> same 500 the Next route
          // produces ("API key not configured").
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Normalize query to lowercase for better cache hits (matches Next).
          const normalizedQuery = query.toLowerCase();

          // Replaces unstable_cache (revalidate 900, key `channels-search-<q>`).
          // Only cache a successful, non-empty channel list — never a failed/empty
          // result, so a transient error isn't pinned for 15 minutes.
          const cached = await withCacheAPI<ChannelsSearchResponse>(
            `channels-search:${normalizedQuery}`,
            900,
            () => searchChannelsUncached(apiKey, normalizedQuery),
            (r) => Array.isArray(r?.channels) && r.channels.length > 0
          );

          // Strip the cache marker so the success body matches the live route exactly.
          const { cacheStatus: _cacheStatus, ...response } = cached;
          return Response.json(response);
        } catch (error: unknown) {
          const err = error as {
            message?: string;
            name?: string;
            response?: { status?: number; data?: { message?: string } };
          };

          if (err.message === 'AbortError' || err.name === 'AbortError') {
            return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
          }

          if (err.message === 'API key not configured') {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          console.error('Error searching channels:', error);

          // Handle Neynar SDK errors (axios-style `error.response`).
          if (err.response) {
            return Response.json(
              { error: err.response.data?.message || 'External API error' },
              { status: err.response.status ?? 500 }
            );
          }

          return Response.json({ error: 'Failed to search channels' }, { status: 500 });
        }
      },
    },
  },
});
