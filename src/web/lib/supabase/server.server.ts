// SERVER-ONLY Supabase clients for TanStack Start on Cloudflare Workers.
//
// Replaces the Next `src/common/helpers/supabase/route.ts` (which used next/headers
// `cookies()` + the deprecated get/set/remove adapter). Here we use the @supabase/ssr
// getAll/setAll adapter fed from the raw request — the pattern proven on workerd by
// the Phase-0 spike (#754):
//   - READ  : parseCookieHeader -> getAll; setAll is a no-op.
//   - WRITE : exchangeCodeForSession drives setAll -> TanStack Start setCookie, which
//             @supabase/ssr chunks into sb-<ref>-auth-token.0/.1 automatically.
//
// `parseCookieHeader` (one decode layer) and chunk reassembly (`combineChunks`) are
// internal to @supabase/ssr — passing it ALL cookies, including .0/.1 chunks, is
// enough for the read path. A hand-rolled `decodeURIComponent` would double-decode
// and corrupt base64url payloads containing '%', so we never roll our own.
//
// IMPORTANT: do NOT import this into a client module — it imports `@/web/lib/env.server`
// (which reads `cloudflare:workers`) and reads runtime secrets that must never reach
// the browser. The dormant browser client lives in ./client.ts instead.
//
// The `.server.ts` filename is LOAD-BEARING: this module imports
// `@tanstack/react-start/server` (`setCookie`), which is on import-protection's default
// client deny-list, and it is reachable from the client route graph (the probe imports
// getUser → here; the auth-callback handler imports it too). The default client
// deny-rule (`**/*.server.*`) mocks this whole module out of the client bundle
// DETERMINISTICALLY in Rollup `build` mode — unlike the runtime `server-only` marker,
// which races against the bundler and let the denied `@tanstack/react-start/server`
// import survive into the client chunk. Every export here only runs server-side
// (loaders / server fns / server route handlers).
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setCookie } from '@tanstack/react-start/server';
import { serverEnv } from '@/web/lib/env.server';

// Accept either the migration-canonical names (.dev.vars.example) or the legacy
// Next NEXT_PUBLIC_* names, so a fork can reuse an existing herocast .env unchanged.
// Read INSIDE these helpers (never at module scope): module-scope reads of the
// `cloudflare:workers` env return undefined on workerd.
export function getSupabaseUrl(): string {
  return serverEnv('SUPABASE_URL') ?? serverEnv('NEXT_PUBLIC_SUPABASE_URL') ?? '';
}

export function getSupabaseAnonKey(): string {
  return serverEnv('SUPABASE_ANON_KEY') ?? serverEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? '';
}

/**
 * The auth cookie name @supabase/ssr looks for is `sb-<projectRef>-auth-token`,
 * where projectRef is the first hostname label of the Supabase URL
 * (SupabaseClient.ts). Returns null if the URL is unparseable.
 */
export function getSupabaseStorageKey(supabaseUrl: string): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

// parseCookieHeader types `value` as `string | undefined`; @supabase/ssr's getAll
// adapter wants `{ name, value: string }[]`. Coerce undefined -> '' (only affects
// valueless cookies, never the sb-* session chunks).
function parseRequestCookies(request: Request): Array<{ name: string; value: string }> {
  return parseCookieHeader(request.headers.get('cookie') ?? '').map((c) => ({
    name: c.name,
    value: c.value ?? '',
  }));
}

/**
 * READ client — for loaders / server fns that call `auth.getUser()` or read session.
 * `getAll` returns the parsed request cookies; `setAll` is a no-op (correct for the
 * read path — token refresh is not persisted here).
 */
export function createSupabaseReadClient(request: Request): SupabaseClient {
  const cookies = parseRequestCookies(request);
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookies;
      },
      setAll() {
        // no-op: read path.
      },
    },
  });
}

/**
 * WRITE client — for the auth callback (`exchangeCodeForSession`) and any flow that
 * must persist the session. Each cookie @supabase/ssr emits (including the chunked
 * sb-*.0/.1 split) is written via TanStack Start's `setCookie`, forced `secure`.
 *
 * CONSTRAINT — works only with a NON-2xx response (redirect). `setCookie` writes to
 * the framework's ambient response-header store, which TanStack Start merges onto a
 * handler-returned `Response` ONLY when it is not 2xx. The auth callback returns a
 * 302, so the Set-Cookie chunks survive. If a future Phase-2/3 route mutates the
 * session and returns a 200 `Response.json(...)`, those Set-Cookie chunks are
 * SILENTLY DROPPED and the user appears logged out with no error. For a 2xx
 * auth-write path, capture the cookies from a custom `setAll` and append them to the
 * returned Response's headers explicitly instead of relying on ambient `setCookie`.
 */
export function createSupabaseWriteClient(request: Request): SupabaseClient {
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
