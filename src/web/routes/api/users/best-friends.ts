import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/users/best-friends — ported from app/api/users/best-friends/route.ts.
// Proxies Neynar's best_friends endpoint. Faithfully mirrors the Next route's query
// params (fid required, limit optional), validation, error shapes/statuses, and the
// success shape (Neynar's response body passed through verbatim). Uses native fetch
// (REST) — no axios/node builtins — and an AbortController timeout that maps to 408,
// matching the source's 19s threshold. The Next route's `maxDuration = 20` (Vercel-only)
// is intentionally dropped.
const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/user/best_friends';

export const Route = createFileRoute('/api/users/best-friends')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const fid = searchParams.get('fid');
          const limit = searchParams.get('limit');

          if (!fid) {
            return Response.json({ error: 'Missing fid parameter' }, { status: 400 });
          }

          // Read secret inside the handler — module-scope env reads are undefined on workerd.
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

            if (!response.ok) {
              // Mirror axios's `error.response` branch: propagate the upstream status and
              // prefer the upstream `message`, else a generic external API error.
              let message: string | undefined;
              try {
                const data: unknown = await response.json();
                if (data && typeof data === 'object' && 'message' in data) {
                  const m = (data as { message?: unknown }).message;
                  if (typeof m === 'string') message = m;
                }
              } catch {
                // body not JSON — fall through to generic message
              }
              console.error('Error fetching best friends:', response.status, message);
              return Response.json({ error: message || 'External API error' }, { status: response.status });
            }

            const data = await response.json();
            return Response.json(data);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error?.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching best friends:', error);

            return Response.json({ error: 'Failed to fetch best friends' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in best friends route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
