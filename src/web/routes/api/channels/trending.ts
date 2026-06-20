import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/channels/trending — faithful port of app/api/channels/trending/route.ts.
// Proxies Neynar's channel/trending endpoint, forwarding an optional `limit` query
// param. No caching in the source (only an in-flight 19s timeout), so none is added.
const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/channel/trending';

export const Route = createFileRoute('/api/channels/trending')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const limit = searchParams.get('limit');

          // Read the secret inside the handler — never at module scope on workerd.
          const API_KEY = getNeynarApiKey();
          if (!API_KEY) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Create params for Neynar API
          const params = new URLSearchParams();
          if (limit) {
            params.append('limit', limit);
          }

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const query = params.toString();
            const response = await fetch(query ? `${NEYNAR_API_URL}?${query}` : NEYNAR_API_URL, {
              headers: {
                accept: 'application/json',
                api_key: API_KEY,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Mirror axios: non-2xx responses surface as an upstream API error.
            if (!response.ok) {
              let message: string | undefined;
              try {
                const body = (await response.json()) as { message?: string };
                message = body?.message;
              } catch {
                message = undefined;
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

            console.error('Error fetching trending channels:', error);

            return Response.json({ error: 'Failed to fetch trending channels' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in trending channels route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
