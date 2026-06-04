// ── Q3 probe ─────────────────────────────────────────────────────────────────
// Server-only. Can a TanStack Start server fn read the Supabase session cookie
// from the request and call supabase.auth.getUser()?
// Mirrors src/common/helpers/supabase/route.ts, but framework-agnostic: instead of
// next/headers cookies(), it reads the raw request Cookie header into the
// @supabase/ssr getAll/setAll adapter (the 0.6+ cookie API; the Next code still
// uses the deprecated get/set/remove form).
import { createServerClient } from '@supabase/ssr';

function parseCookieHeader(header: string | null): Array<{ name: string; value: string }> {
  if (!header) return [];
  return header
    .split(';')
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return null;
      const name = pair.slice(0, idx).trim();
      const raw = pair.slice(idx + 1).trim();
      if (!name) return null;
      try {
        return { name, value: decodeURIComponent(raw) };
      } catch {
        return { name, value: raw };
      }
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

export type GetUserResult = {
  cookiesSeen: string[];
  supabaseCookiesSeen: string[]; // sb-*-auth-token (and chunks)
  user: { id: string; email?: string | null } | null;
  error: { name: string; message: string; status?: number } | null;
  networkValidationAttempted: boolean;
};

export async function getUserFromRequest(
  request: Request,
  supabaseUrl: string,
  anonKey: string
): Promise<GetUserResult> {
  const all = parseCookieHeader(request.headers.get('cookie'));
  const sb = all.filter((c) => c.name.startsWith('sb-'));

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      // The make-or-break: feed request cookies into @supabase/ssr.
      getAll() {
        return all;
      },
      // getUser() is read-only; a real login (auth/callback) would attach these as
      // Set-Cookie on the response. No-op is fine for the read path.
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();

  return {
    cookiesSeen: all.map((c) => c.name),
    supabaseCookiesSeen: sb.map((c) => c.name),
    user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    error: error
      ? { name: error.name, message: error.message, status: (error as any).status }
      : null,
    // With a session cookie present, getUser() hits {url}/auth/v1/user to validate.
    networkValidationAttempted: sb.length > 0,
  };
}
