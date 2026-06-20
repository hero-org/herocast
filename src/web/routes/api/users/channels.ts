import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/users/channels — ported from app/api/users/channels/route.ts.
// Proxies Neynar's /v2/farcaster/user/channels with a 19s timeout, mirroring the live
// Next route's params, validation, error shapes, and success body (Neynar's payload,
// unwrapped). No caching in the source — none added here. `maxDuration` is Vercel-only
// and dropped.
const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/user/channels';

export const Route = createFileRoute('/api/users/channels')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const fid = searchParams.get('fid');
          const limit = searchParams.get('limit');
          const cursor = searchParams.get('cursor');

          if (!fid) {
            return Response.json({ error: 'Missing fid parameter' }, { status: 400 });
          }

          // Read the secret inside the handler — module-scope env reads are undefined on workerd.
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Create params for Neynar API
          const params = new URLSearchParams();
          params.append('fid', fid);
          if (limit) {
            params.append('limit', limit);
          }
          if (cursor) {
            params.append('cursor', cursor);
          }

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const response = await fetch(`${NEYNAR_API_URL}?${params.toString()}`, {
              headers: {
                accept: 'application/json',
                api_key: apiKey,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Non-2xx -> mirror axios's `error.response` branch: surface Neynar's
            // message (when present) with its status code.
            if (!response.ok) {
              let message: string | undefined;
              try {
                const data = (await response.json()) as { message?: string };
                message = data?.message;
              } catch {
                // Body wasn't JSON; fall through to the generic message.
              }
              return Response.json({ error: message || 'External API error' }, { status: response.status });
            }

            const data = await response.json();
            return Response.json(data);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error?.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching user channels:', error);

            return Response.json({ error: 'Failed to fetch user channels' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in user channels route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
