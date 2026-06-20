import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/web/lib/neynar.server';

// GET /api/search — ported from app/api/search/route.ts onto workerd.
// Proxies Neynar's /v2/farcaster/cast/search (REST). Faithful port: same query params
// + defaults, same validation, same error shapes/statuses, and the same transformed
// success body `{ results, isTimeout }` that the client provider parses.
//
// Next->Web changes only:
//   - NextRequest -> the Web `request`; `new URL(request.url).searchParams` unchanged.
//   - axios.get(...) -> native fetch (runs on workerd; no node:http). The 19s
//     AbortController timeout is preserved, mapping AbortError -> 408 exactly as before.
//   - NextResponse.json(x,{status}) -> Response.json(x,{status}).
//   - dropped `export const maxDuration = 20` (Vercel-only).
//
// Caching: the Next source had NO caching (no unstable_cache) — none is added here.
//
// Secrets are read INSIDE the handler via getNeynarApiKey() — module-scope
// `cloudflare:workers` env reads are undefined on workerd. The source read
// `process.env.NEXT_PUBLIC_NEYNAR_API_KEY`; getNeynarApiKey() resolves that same key
// (preferring the un-prefixed Worker secret).

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/cast/search';

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { searchParams } = new URL(request.url);

          const term = searchParams.get('term');
          const q = searchParams.get('q'); // Direct Neynar query parameter
          const limit = parseInt(searchParams.get('limit') || '10', 10);
          const offset = parseInt(searchParams.get('offset') || '0', 10);
          const priorityMode = searchParams.get('priorityMode') === 'true';
          const viewerFid = searchParams.get('viewerFid');
          const parentUrl = searchParams.get('parentUrl');
          const channelId = searchParams.get('channelId');
          const fromFid = searchParams.get('fromFid');

          const apiKey = getNeynarApiKey();
          if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
          }

          // Use direct query if provided, otherwise build from term and filters
          let queryString = q;
          if (!queryString && term) {
            // Build query string with embedded filters (new SearchQueryBuilder parses these)
            const parts = [term];
            if (channelId) parts.push(`channel:${channelId}`);
            if (parentUrl) parts.push(`parent:${parentUrl}`);
            if (fromFid) parts.push(`from:${fromFid}`);
            queryString = parts.join(' ');
          }

          if (!queryString) {
            return Response.json({ error: 'Missing search query' }, { status: 400 });
          }

          // Create params for Neynar API
          const params = new URLSearchParams();
          params.append('q', queryString);
          params.append('limit', limit.toString());
          if (offset > 0) {
            params.append('offset', offset.toString());
          }
          if (priorityMode) {
            params.append('priority_mode', 'true');
          }
          if (viewerFid) {
            params.append('viewer_fid', viewerFid);
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
              // Mirror axios's error.response branch: surface the upstream message
              // (Neynar returns `{ message }`) and pass the status through unchanged.
              let message = 'External API error';
              try {
                const errorBody = (await response.json()) as { message?: string };
                if (errorBody?.message) {
                  message = errorBody.message;
                }
              } catch {
                // Non-JSON error body — fall back to the generic message above.
              }
              console.error('Error searching casts:', message);
              return Response.json({ error: message }, { status: response.status });
            }

            // Transform Neynar response to match frontend SearchResponse type
            // Neynar returns: { result: { casts: [...] } }
            // Frontend expects: { results: [{ hash, fid, text, timestamp }] }
            const data = (await response.json()) as { result?: { casts?: any[] } };
            const neynarCasts = data?.result?.casts || [];
            const results = neynarCasts.map((cast: any) => ({
              hash: cast.hash,
              fid: cast.author?.fid,
              text: cast.text,
              timestamp: cast.timestamp,
            }));

            return Response.json({ results, isTimeout: false });
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error?.name === 'AbortError') {
              return Response.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
            }

            console.error('Error searching casts:', error);

            return Response.json({ error: 'Failed to search casts' }, { status: 500 });
          }
        } catch (error) {
          console.error('Error in search route:', error);
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      },
    },
  },
});
