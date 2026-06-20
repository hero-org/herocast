import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/casts/reactions — ported from app/api/casts/reactions/route.ts.
// Proxies Neynar's /v2/farcaster/reactions/cast endpoint (REST). Faithful port:
// same query params + defaults, same validation, same error shapes/statuses, and the
// raw upstream JSON as the success body (the client provider parses this exact shape).
//
// Secrets are read INSIDE the handler via getNeynarApiKey() — module-scope
// `cloudflare:workers` env reads are undefined on workerd.

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/reactions/cast';

export const Route = createFileRoute('/api/casts/reactions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const hash = searchParams.get('hash');
          const types = searchParams.get('types') || 'likes,recasts';
          const limit = searchParams.get('limit');
          const cursor = searchParams.get('cursor');

          if (!hash) {
            return Response.json({ error: 'Missing hash parameter' }, { status: 400 });
          }

          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Create params for Neynar API
          const params = new URLSearchParams();
          params.append('hash', hash);
          params.append('types', types);
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

            if (!response.ok) {
              let message = 'External API error';
              try {
                const errorBody = (await response.json()) as { message?: string };
                if (errorBody?.message) {
                  message = errorBody.message;
                }
              } catch {
                // Non-JSON error body — fall back to the generic message above.
              }
              return Response.json({ error: message }, { status: response.status });
            }

            const data = await response.json();
            return Response.json(data);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error?.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching cast reactions:', error);

            return Response.json({ error: 'Failed to fetch cast reactions' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in cast reactions route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
