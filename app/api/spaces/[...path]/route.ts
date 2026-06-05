/**
 * Same-origin proxy for Farcaster's audio-room (Spaces) control plane.
 *
 * The browser talks ONLY to this route (same-origin, no CORS). This route
 * attaches the per-account Farcaster session bearer — minted and held
 * strictly server-side (see `serverBearer.ts`) — plus the `origin`/`referer`
 * headers a browser cannot set, and forwards to `client.farcaster.xyz`.
 *
 * SECURITY (the core property of this feature):
 *   - The Farcaster bearer is ONLY ever an outbound `Authorization` header.
 *     It is never placed in any response body. Farcaster does not echo it,
 *     so a plain pass-through of the upstream body is safe.
 *   - The signer never leaves the edge function.
 *   - When the flag is off, this route 404s and no Spaces code runs.
 *
 * Contract (so the client slice matches):
 *   - Path:    /api/spaces/<farcaster-path>  →  forwards to
 *              https://client.farcaster.xyz/<farcaster-path>
 *              e.g. GET  /api/spaces/v1/audio-rooms?limit=30
 *                   POST /api/spaces/v1/audio-room/join   body {roomId}
 *   - Account: request header `x-herocast-account-id` (preferred) or the
 *              `?accountId=` query param. The proxy strips `accountId` from
 *              the forwarded query.
 *   - Auth:    the herocast Supabase session (cookie). 401 if absent.
 *   - Body/method/remaining query are forwarded verbatim.
 *   - The upstream JSON body + status are returned unchanged.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  FARCASTER_AUDIO_BASE_URL,
  FARCASTER_AUDIO_ORIGIN,
  FARCASTER_AUDIO_REFERER,
  SPACES_ENABLED,
} from '@/common/constants/spaces';
import { getServerBearer } from '@/common/helpers/spaces/serverBearer';
import { createClient } from '@/common/helpers/supabase/route';

export const maxDuration = 20;

/** Upstream is slow at times; keep under Vercel's `maxDuration`. */
const TIMEOUT_MS = 19_000;

const ACCOUNT_HEADER = 'x-herocast-account-id';

/**
 * Allowlist of Farcaster audio-room control-plane paths this proxy may reach.
 * Locks the catch-all to the v1 Spaces surface so a caller's bearer can't be
 * used to drive arbitrary first-party `client.farcaster.xyz` endpoints.
 */
const ALLOWED_PATHS: Record<string, Set<string>> = {
  GET: new Set(['v1/audio-rooms', 'v1/audio-rooms/scheduled', 'v1/audio-room', 'v1/audio-room/participants']),
  POST: new Set([
    'v1/audio-rooms',
    'v1/audio-room/join',
    'v1/audio-room/leave',
    'v1/audio-room/heartbeat',
    'v1/audio-room/start-scheduled',
    'v1/audio-room/end',
    'v1/audio-room/update',
  ]),
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Resolve the forward query string (with our `accountId` control param
 * stripped) and the account id carried on the header or query.
 */
function resolveQuery(request: NextRequest): { headerOrQueryAccountId: string | null; forwardSearch: string } {
  const url = new URL(request.url);
  const headerId = request.headers.get(ACCOUNT_HEADER);
  const queryId = url.searchParams.get('accountId');
  const headerOrQueryAccountId = (headerId || queryId || '').trim() || null;

  // Strip our control param before forwarding to Farcaster.
  url.searchParams.delete('accountId');
  const qs = url.searchParams.toString();
  return { headerOrQueryAccountId, forwardSearch: qs ? `?${qs}` : '' };
}

/**
 * For POST: the body may carry `accountId` (the `navigator.sendBeacon` leave
 * path can't set headers — see `spacesApi.leaveRoomBeacon`). Pull it out as a
 * fallback and return the body to forward with `accountId` removed (so it's
 * never sent on to Farcaster). Non-JSON bodies pass through untouched.
 */
function extractAccountFromBody(bodyText: string | undefined): { bodyAccountId: string | null; forwardBody?: string } {
  if (!bodyText) return { bodyAccountId: null, forwardBody: bodyText };
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && typeof parsed.accountId === 'string') {
      const bodyAccountId = parsed.accountId.trim() || null;
      const { accountId: _omit, ...rest } = parsed;
      return { bodyAccountId, forwardBody: JSON.stringify(rest) };
    }
  } catch {
    // not JSON — leave the body as-is
  }
  return { bodyAccountId: null, forwardBody: bodyText };
}

/**
 * Perform the upstream fetch with the bearer attached. Returns the raw
 * upstream `Response`. Does NOT throw on non-2xx — the caller inspects
 * `status` (to handle the 401 re-mint) and passes the body through.
 */
async function forwardToFarcaster(
  targetUrl: string,
  method: string,
  bearer: string,
  bodyText: string | undefined,
  signal: AbortSignal
): Promise<Response> {
  const headers: Record<string, string> = {
    accept: '*/*',
    authorization: `Bearer ${bearer}`,
    // Browser-forbidden headers — the whole reason this is a proxy.
    origin: FARCASTER_AUDIO_ORIGIN,
    referer: FARCASTER_AUDIO_REFERER,
  };
  if (method === 'POST') {
    headers['content-type'] = 'application/json; charset=utf-8';
  }

  return fetch(targetUrl, {
    method,
    headers,
    body: method === 'POST' ? (bodyText ?? '{}') : undefined,
    // Personalized + bearer-authed — never cache.
    cache: 'no-store',
    signal,
  });
}

async function handle(request: NextRequest, pathSegments: string[], method: 'GET' | 'POST'): Promise<NextResponse> {
  // Flag gate: when Spaces is off, this route does not exist.
  if (!SPACES_ENABLED) {
    return jsonError('Not found', 404);
  }

  // Authenticate the herocast user via the route-handler Supabase client.
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonError('Unauthorized', 401);
  }

  // We need the access token to forward to the edge fn so its RPC auth.uid()
  // filter passes (the bearer mint is owner-scoped).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return jsonError('Unauthorized', 401);
  }

  const { headerOrQueryAccountId, forwardSearch } = resolveQuery(request);

  // Capture the body once (POST only) so we can replay it on the 401 retry,
  // and pull a body-embedded `accountId` (sendBeacon leave) out of it.
  let bodyText: string | undefined;
  let bodyAccountId: string | null = null;
  if (method === 'POST') {
    const raw = await request.text().catch(() => '');
    const extracted = extractAccountFromBody(raw);
    bodyAccountId = extracted.bodyAccountId;
    bodyText = extracted.forwardBody;
  }

  // Header/query wins; body is the fallback for the header-less beacon path.
  const accountId = headerOrQueryAccountId || bodyAccountId;
  if (!accountId) {
    return jsonError('Missing account id (x-herocast-account-id header or accountId query)', 400);
  }

  const path = pathSegments.join('/');
  if (!path) {
    return jsonError('Missing Farcaster audio-room path', 400);
  }
  if (!ALLOWED_PATHS[method]?.has(path)) {
    return jsonError('Forbidden audio-room path', 403);
  }
  const targetUrl = `${FARCASTER_AUDIO_BASE_URL}/${path}${forwardSearch}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let bearer: string;
    try {
      bearer = await getServerBearer(user.id, accountId, accessToken);
    } catch (mintErr) {
      const status = (mintErr as { status?: number })?.status;
      // Diagnostic (dev): surface the real mint failure. Never logs the bearer.
      console.error('[spaces proxy] bearer mint failed', {
        status,
        message: (mintErr as Error)?.message,
      });
      // 401/403 from the edge fn ⇒ the user doesn't own this account (or the
      // session is bad). Anything else is an upstream mint failure.
      return jsonError('Unable to authorize Spaces for this account', status === 401 || status === 403 ? 403 : 502);
    }

    let upstream = await forwardToFarcaster(targetUrl, method, bearer, bodyText, controller.signal);

    // Farcaster rejected the bearer (expired/rotated): re-mint once and retry.
    if (upstream.status === 401) {
      let fresh: string;
      try {
        fresh = await getServerBearer(user.id, accountId, accessToken, true);
      } catch {
        return jsonError('Spaces authorization expired', 401);
      }
      upstream = await forwardToFarcaster(targetUrl, method, fresh, bodyText, controller.signal);
    }

    clearTimeout(timeoutId);

    // Pass the upstream body + status straight through. The bearer is never
    // in this body (Farcaster does not echo it; we add nothing).
    const text = await upstream.text().catch(() => '');
    if (upstream.status >= 400) {
      // Diagnostic (dev): a 401 here = Farcaster rejected our app-key JWT
      // (Tier 1 auth red — the live Phase 0 answer). Body has no bearer.
      console.error('[spaces proxy] farcaster non-2xx', {
        path,
        status: upstream.status,
        body: text.slice(0, 300),
      });
    }
    const contentType = upstream.headers.get('content-type') || 'application/json';
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store',
      },
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as { name?: string };
    if (err?.name === 'AbortError') {
      return jsonError('Upstream request timed out', 504);
    }
    // Network/unknown error — degrade with a small JSON error, never a stack.
    console.error('[spaces proxy] upstream fetch error', { path, message: (error as Error)?.message });
    return jsonError('Spaces upstream error', 502);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(request, path ?? [], 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(request, path ?? [], 'POST');
}
