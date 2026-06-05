// SERVER-ONLY Supabase clients for TanStack Start on Cloudflare Workers.
//
// Replaces the Next `src/common/helpers/supabase/route.ts` (which used next/headers
// `cookies()` + the deprecated get/set/remove adapter). Here we use the @supabase/ssr
// getAll/setAll adapter fed from the raw request — the pattern proven on workerd by
// the Phase-0 spike (#754):
//   - READ  : getRequest() -> parseCookieHeader -> getAll; setAll is a no-op.
//   - WRITE : exchangeCodeForSession drives setAll -> TanStack Start setCookie, which
//             @supabase/ssr chunks into sb-<ref>-auth-token.0/.1 automatically.
//
// `parseCookieHeader` (one decode layer) and chunk reassembly (`combineChunks`) are
// internal to @supabase/ssr — passing it ALL cookies, including .0/.1 chunks, is
// enough for the read path.
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setCookie } from '@tanstack/react-start/server';
import { serverEnv } from '@/lib/env';

// Accept either the migration-canonical names (.dev.vars.example) or the legacy
// Next NEXT_PUBLIC_* names, so a fork can reuse an existing herocast .env unchanged.
export function getSupabaseUrl(): string {
  return serverEnv('SUPABASE_URL') || serverEnv('NEXT_PUBLIC_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return serverEnv('SUPABASE_ANON_KEY') || serverEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// parseCookieHeader types value as `string | undefined`; @supabase/ssr's getAll
// adapter wants `{ name, value: string }[]`. Coerce undefined -> '' (only affects
// valueless cookies, never the sb-* session chunks).
function parseRequestCookies(request: Request): Array<{ name: string; value: string }> {
  return parseCookieHeader(request.headers.get('cookie') ?? '').map((c) => ({
    name: c.name,
    value: c.value ?? '',
  }));
}

/**
 * Read-only server client — for loaders / server fns that call `auth.getUser()` or
 * read session. `setAll` is a no-op (correct for the read path).
 */
export function createServerClientReadOnly(request: Request): SupabaseClient {
  const cookies = parseRequestCookies(request);
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookies;
      },
      setAll() {
        // no-op: read path. Token refresh is not persisted here.
      },
    },
  });
}

/**
 * Writable server client — for the auth callback (`exchangeCodeForSession`) and any
 * flow that must persist the session. Each cookie @supabase/ssr emits (including the
 * chunked sb-*.0/.1 split) is written via TanStack Start's `setCookie`, forced `secure`.
 *
 * ⚠️ CONSTRAINT — works only with a NON-2xx response (redirect). `setCookie` writes to
 * the framework's ambient response-header store, which TanStack Start merges onto a
 * handler-returned `Response` ONLY when it is not 2xx
 * (`mergeEventResponseHeaders`: `if (response.ok) return;`, plus h3's `prepareResponse`
 * `!val.ok` guard). The auth callback returns a 302, so the Set-Cookie chunks survive.
 * If a future Phase-2/3 route mutates the session (exchange/setSession/refresh/signOut/
 * verifyOtp) and returns a 200 `Response.json(...)`, those Set-Cookie chunks are SILENTLY
 * DROPPED and the user appears logged out with no error. For a 2xx auth-write path,
 * capture the cookies from a custom `setAll` and append them to the returned Response's
 * headers explicitly instead of relying on the ambient `setCookie`.
 */
export function createServerClientWritable(request: Request): SupabaseClient {
  const cookies = parseRequestCookies(request);
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookies;
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, { ...options, secure: true });
        }
      },
    },
  });
}

/**
 * Convenience read of the current user from the request cookie. Never throws —
 * returns `{ user: null, error }` so callers (loaders) can render a clean shell
 * even when secrets are unset.
 */
export async function getUserFromRequest(
  request: Request
): Promise<{ user: { id: string; email?: string | null } | null; error: { name: string; message: string } | null }> {
  try {
    const supabase = createServerClientReadOnly(request);
    const { data, error } = await supabase.auth.getUser();
    return {
      user: data?.user ? { id: data.user.id, email: data.user.email } : null,
      error: error ? { name: error.name, message: error.message } : null,
    };
  } catch (e) {
    const err = e as Error;
    return { user: null, error: { name: err.name || 'Error', message: err.message || String(e) } };
  }
}
