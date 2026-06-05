/**
 * Server-side Farcaster audio-room (Spaces) bearer mint + warm cache.
 *
 * SECURITY: this module runs ONLY in the same-origin proxy
 * (`app/api/spaces/[...path]`). The bearer it produces is the Farcaster
 * session token for the audio-room control plane and must NEVER reach the
 * browser. Nothing here is imported from client code.
 *
 * The bearer is minted by the `farcaster-signer` edge function
 * (`POST /audio-room-token`, action `mintAudioRoomToken`). We model the
 * server-to-server call on `callSignerService` in
 * `src/common/helpers/farcaster.ts`: forward the herocast user's Supabase
 * access token as `Authorization` so the edge fn's `decrypted_account`
 * RPC `auth.uid()` filter passes and the caller can only mint for accounts
 * they own.
 *
 * Caching is a warm-lambda best-effort: a module-level
 * `Map<accountId, CachedBearer>` survives within a hot serverless instance
 * but not across cold starts. That is fine — a cold start just re-mints.
 */

import { SPACE_TOKEN_REFRESH_SKEW_S } from '@/common/constants/spaces';

interface CachedBearer {
  token: string;
  /** epoch ms at which the bearer expires (from the edge fn). */
  expiresAt: number;
}

interface MintResponse {
  success?: boolean;
  token?: string;
  expiresAt?: number;
  scheme?: string;
  error?: { code?: string; message?: string };
}

/**
 * Warm-lambda bearer cache, keyed by immutable herocast account id. Best
 * effort: lost on cold start. We re-mint when the cached token is within
 * `SPACE_TOKEN_REFRESH_SKEW_S` of expiry, or when a caller forces it after
 * a 401 from Farcaster.
 */
const bearerCache = new Map<string, CachedBearer>();

function getSignerServiceUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for signer service.');
  }
  return `${supabaseUrl}/functions/v1/farcaster-signer`;
}

/** True when a cached bearer is missing or within the refresh skew of expiry. */
function isStale(entry: CachedBearer | undefined): boolean {
  if (!entry) return true;
  return entry.expiresAt - Date.now() <= SPACE_TOKEN_REFRESH_SKEW_S * 1000;
}

/**
 * Mint a fresh bearer via the edge function and cache it. Throws on a
 * non-2xx / malformed response so the proxy can surface the status.
 */
async function mintBearer(accountId: string, accessToken: string): Promise<CachedBearer> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for signer service.');
  }

  const response = await fetch(`${getSignerServiceUrl()}/audio-room-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward the herocast user's session so the edge fn's RPC auth.uid()
      // filter passes — same trust boundary as the cast/reaction handlers.
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    // Mirrors the edge fn handler's `{ account_id }` body. `action` is
    // included for parity with the spec's `mintAudioRoomToken` naming; the
    // edge fn routes on the `/audio-room-token` path.
    body: JSON.stringify({ action: 'mintAudioRoomToken', account_id: accountId }),
  });

  let data: MintResponse | null = null;
  try {
    data = (await response.json()) as MintResponse;
  } catch {
    // fall through to status-based error below
  }

  if (!response.ok || !data?.token || typeof data.expiresAt !== 'number') {
    const message = data?.error?.message || `Bearer mint failed (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status });
  }

  // The caller (`getServerBearer`) owns the cache write so it can key the
  // entry by `${userId}:${accountId}` (the mint here is owner-scoped per the
  // forwarded access token, but the cache must not be reusable cross-user).
  return { token: data.token, expiresAt: data.expiresAt };
}

/**
 * Get a usable bearer for `accountId`, minting (and caching) one if the
 * cache is empty/stale. Pass `forceRefresh: true` to bypass the cache after
 * a 401 from Farcaster.
 *
 * @returns the bearer token string (never logged by callers).
 */
export async function getServerBearer(
  userId: string,
  accountId: string,
  accessToken: string,
  forceRefresh = false
): Promise<string> {
  // SECURITY: key the cache by the CALLER's user id, not just the account id.
  // A cache HIT returns without re-minting, and minting is the only place
  // account ownership is enforced (via the forwarded access token). Keying by
  // accountId alone would let any authenticated user reuse another user's
  // warm bearer by sending that account id in the proxy header. With
  // `${userId}:${accountId}`, a cross-account lookup misses → re-mints with the
  // caller's own token → the edge fn rejects it (not their account).
  const key = `${userId}:${accountId}`;
  const cached = bearerCache.get(key);
  if (!forceRefresh && !isStale(cached)) {
    return cached!.token;
  }
  const fresh = await mintBearer(accountId, accessToken);
  bearerCache.set(key, fresh);
  return fresh.token;
}

/** Drop a cached bearer (e.g. on a hard auth failure). Test/maintenance hook. */
export function invalidateServerBearer(userId: string, accountId: string): void {
  bearerCache.delete(`${userId}:${accountId}`);
}
