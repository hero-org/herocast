// ── Q3 probe ─────────────────────────────────────────────────────────────────
// Server-only. Can a TanStack Start server fn read the Supabase session cookie
// from the request and call supabase.auth.getUser()?
// Mirrors src/common/helpers/supabase/route.ts but framework-agnostic: instead of
// next/headers cookies(), it parses the raw request Cookie header into the
// @supabase/ssr getAll/setAll adapter (the 0.6+ cookie API; the Next code still
// uses the deprecated get/set/remove form).
//
// Uses @supabase/ssr's own parseCookieHeader so there's exactly ONE decode layer
// (a hand-rolled decodeURIComponent on top of cookie.parse would double-decode and
// corrupt base64url payloads containing '%').
import { createServerClient, parseCookieHeader } from '@supabase/ssr';

// The auth cookie name @supabase/ssr looks for is sb-<projectRef>-auth-token, where
// projectRef is the first hostname label of the Supabase URL (SupabaseClient.ts:324).
function deriveStorageKey(supabaseUrl: string): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

// getUser() only hits {url}/auth/v1/user once a session is decoded from the cookie.
// Infer "network reached" truthfully from the error class — NOT from "an sb cookie
// exists" (which is true even when the name/ref mismatches and nothing decodes).
//  - AuthSessionMissingError  -> no session decoded -> network NOT reached
//  - AuthRetryableFetchError  -> fetch/connection failed -> network WAS reached
//  - AuthApiError             -> non-2xx from /user      -> network WAS reached
//  - no error (user present)  -> 2xx                      -> network WAS reached
function reachedNetwork(errName: string | null, hasUser: boolean): boolean {
  if (hasUser) return true;
  return errName === 'AuthRetryableFetchError' || errName === 'AuthApiError';
}

export type GetUserResult = {
  expectedStorageKey: string | null;
  cookiesSeen: string[];
  supabaseCookiesSeen: string[];
  sessionCookieMatched: boolean; // did a cookie with the expected storage key arrive?
  user: { id: string; email?: string | null } | null;
  error: { name: string; message: string; status?: number } | null;
  networkValidationAttempted: boolean;
};

export async function getUserFromRequest(
  request: Request,
  supabaseUrl: string,
  anonKey: string
): Promise<GetUserResult> {
  const all = parseCookieHeader(request.headers.get('cookie') ?? '');
  const expectedStorageKey = deriveStorageKey(supabaseUrl);
  const sb = all.filter((c) => c.name.startsWith('sb-'));

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      // The make-or-break: feed request cookies into @supabase/ssr.
      getAll() {
        return all;
      },
      // getUser() is read-only; a real login (auth/callback) would attach Set-Cookie
      // via setAll. No-op is correct for the read path (and a far-future expires_at
      // means no token refresh is attempted, so nothing needs persisting here).
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const errName = error ? error.name : null;
  const hasUser = Boolean(data?.user);

  return {
    expectedStorageKey,
    cookiesSeen: all.map((c) => c.name),
    supabaseCookiesSeen: sb.map((c) => c.name),
    sessionCookieMatched: expectedStorageKey
      ? all.some((c) => c.name === expectedStorageKey || c.name.startsWith(`${expectedStorageKey}.`))
      : false,
    user: hasUser ? { id: data!.user!.id, email: data!.user!.email } : null,
    error: error ? { name: error.name, message: error.message, status: (error as any).status } : null,
    networkValidationAttempted: reachedNetwork(errName, hasUser),
  };
}
