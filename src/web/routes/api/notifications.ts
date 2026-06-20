import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/notifications — faithful port of app/api/notifications/route.ts.
// Proxies Neynar's notifications endpoint with the same query params, validation,
// error responses, and pass-through success shape the client provider expects.
// Ported from axios -> native fetch (workerd-friendly, no node builtins); the
// upstream error shape is reproduced from the response status + JSON body.
const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/notifications';

export const Route = createFileRoute('/api/notifications')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const fid = searchParams.get('fid');
          const cursor = searchParams.get('cursor');
          const limit = searchParams.get('limit') || '25';
          const type = searchParams.get('type'); // Type filter: follows, recasts, likes, mentions, replies, quotes

          if (!fid) {
            return Response.json({ error: 'Missing fid parameter' }, { status: 400 });
          }

          // Read the secret inside the handler — never at module scope on workerd.
          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Create params for Neynar API
          const params = new URLSearchParams();
          params.append('fid', fid);
          params.append('limit', limit);
          if (cursor) {
            params.append('cursor', cursor);
          }
          if (type) {
            params.append('type', type);
          }

          // Set up timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

          try {
            const response = await fetch(`${NEYNAR_API_URL}?${params.toString()}`, {
              headers: {
                accept: 'application/json',
                api_key: apiKey,
                'x-neynar-experimental': 'true',
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const data = (await response.json().catch(() => null)) as { message?: string } | null;
              return Response.json({ error: data?.message || 'External API error' }, { status: response.status });
            }

            const data = await response.json();
            return Response.json(data);
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error?.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error fetching notifications:', error);

            return Response.json({ error: 'Failed to fetch notifications' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in notifications route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
