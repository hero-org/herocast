// SERVER-ONLY route. Ports app/api/users/route.ts onto the TanStack Start worker (workerd).
//   Neynar: @neynar/nodejs-sdk v1 string constructor `new NeynarAPIClient(apiKey)`
//           (`client.fetchBulkUsers`) — the EXACT call the live Next route makes; proven
//           to run on workerd under nodejs_compat.
//   Cache:  replaces next/cache `unstable_cache` (revalidate 600s) with the shared
//           edge-cache seam `withCacheAPI`. We cache the inner `{ users }` payload, key
//           `users:<fids>:<viewerFid|anon>`, TTL 600s — and NEVER cache an empty result
//           (an empty/over-quota response must not be pinned for 10 minutes). `cacheStatus`
//           is stripped from the response so the success JSON shape stays exactly `{ users }`
//           — the shape the client provider parses.
//   maxDuration: Vercel-only, dropped.

import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { createFileRoute } from '@tanstack/react-router';
import { withCacheAPI } from '@/web/lib/cache.server';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';

async function fetchUsersUncached(apiKey: string, fids: string, viewerFid: number | null) {
  // Parse and validate FIDs
  const fidsArray = fids.split(',').map((fid) => parseInt(fid.trim(), 10));

  if (fidsArray.length === 0) {
    return { users: [] };
  }

  if (fidsArray.length > 100) {
    throw new Error('Maximum 100 FIDs allowed');
  }

  if (fidsArray.some((fid) => isNaN(fid) || fid <= 0)) {
    throw new Error('Invalid FID format');
  }

  // Set up timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const neynarClient = new NeynarAPIClient(apiKey);

    const options: { viewerFid?: number } = {};
    if (viewerFid && viewerFid > 0) {
      options.viewerFid = viewerFid;
    }

    const response = await Promise.race([
      neynarClient.fetchBulkUsers(fidsArray, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
    ]);

    clearTimeout(timeoutId);

    // Extract users array from response
    const users = (response as any)?.users || [];

    return { users };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.message === 'AbortError' || error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw error;
  }
}

// Cached version. Replaces the live route's `unstable_cache(..., { revalidate: 600 })`.
// NEVER cache an empty result (forkability / over-quota safety). `cacheStatus` is dropped
// by the caller so the success payload stays exactly `{ users }`.
function getCachedUsers(apiKey: string, fids: string, viewerFid: number | null) {
  return withCacheAPI(
    `users:${fids}:${viewerFid ?? 'anon'}`,
    600, // 10 minutes
    () => fetchUsersUncached(apiKey, fids, viewerFid),
    (result) => Array.isArray(result.users) && result.users.length > 0
  );
}

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const fidsParam = searchParams.get('fids');
          const viewerFidParam = searchParams.get('viewer_fid');

          if (!fidsParam) {
            return Response.json({ error: 'Missing fids parameter' }, { status: 400 });
          }

          // Read the secret inside the handler — never at module scope (undefined on workerd).
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Parse and validate viewerFid
          let viewerFid: number | null = null;
          if (viewerFidParam) {
            const viewerFidNum = parseInt(viewerFidParam, 10);
            if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
              viewerFid = viewerFidNum;
            }
          }

          const cached = await getCachedUsers(apiKey, fidsParam, viewerFid);
          // Strip the cache-seam marker so the success shape stays exactly `{ users }`.
          const { cacheStatus: _cacheStatus, ...result } = cached;
          return Response.json(result);
        } catch (error: any) {
          console.error('Error in users route:', error);

          // Handle timeout errors
          if (error.message === TIMEOUT_ERROR_MESSAGE) {
            return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
          }

          // Handle validation errors
          if (error.message === 'Maximum 100 FIDs allowed' || error.message === 'Invalid FID format') {
            return Response.json({ error: error.message }, { status: 400 });
          }

          // Handle API key errors
          if (error.message === 'API key not configured') {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Handle Neynar SDK errors
          if (error.response) {
            return Response.json(
              { error: error.response.data?.message || 'External API error' },
              { status: error.response.status }
            );
          }

          return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
        }
      },
    },
  },
});
