import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

const UPSTREAM_BASE = 'https://haatz.quilibrium.com/v2/farcaster';
const TIMEOUT_MS = 19000;

// Per-route cache config. ttl=null → uncached passthrough (personalized routes like notifications).
// TTLs picked to match the closest semantically-equivalent Neynar route — do not invent new TTLs.
const ROUTE_CONFIG: Record<string, { ttl: number | null }> = {
  user: { ttl: 600 },
  'user/by-username': { ttl: 600 },
  'user/bulk': { ttl: 600 },
  'user/search': { ttl: 300 },
  feed: { ttl: 120 },
  'feed/following': { ttl: 120 },
  'feed/channels': { ttl: 120 },
  'feed/user/casts': { ttl: 120 },
  'reaction/user': { ttl: 120 },
  cast: { ttl: 600 },
  'cast/bulk': { ttl: 600 },
  'cast/conversation': { ttl: 300 },
  'cast/search': { ttl: 300 },
  channel: { ttl: 7200 },
  'channel/search': { ttl: 900 },
  'channel/all': { ttl: 7200 },
  notifications: { ttl: null },
};

async function fetchUpstream(path: string, search: string, signal: AbortSignal): Promise<unknown> {
  const url = `${UPSTREAM_BASE}/${path}${search}`;
  // cache: 'no-store' — defer caching to the outer unstable_cache layer so non-2xx responses
  // (which throw below) don't poison the cache for the full TTL.
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Hypersnap upstream ${res.status}: ${body || res.statusText}`), {
      status: res.status,
    });
  }
  return res.json();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined = path.join('/');
  const config = ROUTE_CONFIG[joined];
  if (!config) {
    return NextResponse.json({ error: 'Unknown hypersnap route' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const sortedParams = new URLSearchParams(
    [...searchParams.entries()].sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
  );
  const search = sortedParams.toString() ? `?${sortedParams.toString()}` : '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const tag = `hypersnap-${joined.replace(/\//g, '-')}`;
    const data =
      config.ttl === null
        ? await fetchUpstream(joined, search, controller.signal)
        : await unstable_cache(
            () => fetchUpstream(joined, search, controller.signal),
            [joined, sortedParams.toString()],
            {
              revalidate: config.ttl,
              tags: ['hypersnap', tag],
            }
          )();

    clearTimeout(timeoutId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as { name?: string; message?: string; status?: number };
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 408 });
    }
    return NextResponse.json({ error: err?.message || 'Hypersnap proxy error' }, { status: err?.status || 502 });
  }
}

export const maxDuration = 25;
