// SERVER-ONLY (`.server.ts`). The Supabase read path: parse the request cookie, call
// `auth.getUser()`, and report back enough evidence for the migration probe to confirm
// the cookie round-trip works on workerd.
//
// `getUserFromRequest` MUST NEVER THROW — it returns `{ user: null, error }` so a loader
// / the SSR shell renders cleanly even when secrets are unset or the network is
// unreachable.
//
// The `.server.ts` filename is LOAD-BEARING: this module imports the Supabase server
// client (`@/web/lib/supabase/server.server` → `@tanstack/react-start/server` +
// `cloudflare:workers`), which import-protection denies in the client. Keeping the
// implementation here — separate from the client-importable server-fn wrapper in
// `getUser.ts` — means the default client deny-rule (`**/*.server.*`) mocks this whole
// module out of the client bundle DETERMINISTICALLY. (When this logic lived inline in
// the server-fn module, the exported `getUserFromRequest` held the denied
// `supabase/server.server` import alive in the client chunk and the build failed.)
import { parseCookieHeader } from '@supabase/ssr';
import { createSupabaseReadClient, getSupabaseStorageKey } from '@/web/lib/supabase/server.server';

export type GetUserResult = {
  user: { id: string; email?: string | null } | null;
  error: { name: string; message: string; status?: number } | null;
  /** Did a cookie with the expected `sb-<ref>-auth-token` storage key arrive? */
  sessionCookieMatched: boolean;
  /** Did `getUser()` actually reach the Supabase /auth/v1/user endpoint? */
  networkValidationAttempted: boolean;
};

// `getUser()` only hits {url}/auth/v1/user once a session is decoded from the cookie.
// Infer "network reached" truthfully from the error CLASS — NOT from "an sb cookie
// exists" (true even when the name/ref mismatches and nothing decodes).
//  - AuthSessionMissingError  -> no session decoded -> network NOT reached
//  - AuthRetryableFetchError  -> fetch/connection failed -> network WAS reached
//  - AuthApiError             -> non-2xx from /user      -> network WAS reached
//  - no error (user present)  -> 2xx                      -> network WAS reached
function reachedNetwork(errName: string | null, hasUser: boolean): boolean {
  if (hasUser) return true;
  return errName === 'AuthRetryableFetchError' || errName === 'AuthApiError';
}

/**
 * Read the current Supabase user from the request cookie. Never throws.
 */
export async function getUserFromRequest(
  request: Request,
  supabaseUrl: string,
  anonKey: string
): Promise<GetUserResult> {
  try {
    const all = parseCookieHeader(request.headers.get('cookie') ?? '');
    const expectedStorageKey = getSupabaseStorageKey(supabaseUrl);
    const sessionCookieMatched = expectedStorageKey
      ? all.some((c) => c.name === expectedStorageKey || c.name.startsWith(`${expectedStorageKey}.`))
      : false;

    // Guard against an empty config: createServerClient throws synchronously on a
    // blank url/anon key, so bail with a clean shell rather than letting it bubble.
    if (!supabaseUrl || !anonKey) {
      return {
        user: null,
        error: { name: 'ConfigError', message: 'Missing SUPABASE_URL / SUPABASE_ANON_KEY' },
        sessionCookieMatched,
        networkValidationAttempted: false,
      };
    }

    const supabase = createSupabaseReadClient(request);
    const { data, error } = await supabase.auth.getUser();
    const errName = error ? error.name : null;
    const hasUser = Boolean(data?.user);

    return {
      user: hasUser ? { id: data.user!.id, email: data.user!.email } : null,
      error: error ? { name: error.name, message: error.message, status: (error as { status?: number }).status } : null,
      sessionCookieMatched,
      networkValidationAttempted: reachedNetwork(errName, hasUser),
    };
  } catch (e) {
    const err = e as Error;
    return {
      user: null,
      error: { name: err.name || 'Error', message: err.message || String(e) },
      sessionCookieMatched: false,
      networkValidationAttempted: false,
    };
  }
}
