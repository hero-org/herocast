// ── Phase 0.5b: auth WRITE / login round-trip probe ──────────────────────────
// On a real exchangeCodeForSession, @supabase/ssr's applyServerStorage saves the
// session as `base64-` + base64url(JSON), runs createChunks(), and writes each chunk
// through the setAll adapter. We can't run the live OAuth exchange, so we reproduce
// the exact serialization with the library's OWN helpers AND write the chunks via
// TanStack Start's framework cookie API (setCookie) — testing the real write path on
// workerd, not a hand-rolled Response.
import { createFileRoute } from '@tanstack/react-router';
import { setCookie } from '@tanstack/react-start/server';
import {
  createChunks,
  stringToBase64URL,
  MAX_CHUNK_SIZE,
  DEFAULT_COOKIE_OPTIONS,
} from '@supabase/ssr';

function envVar(key: string): string {
  return (globalThis as any).process?.env?.[key] ?? '';
}

function deriveStorageKey(url: string): string {
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-unknown-auth-token';
  }
}

export const Route = createFileRoute('/api/auth-write')({
  server: {
    handlers: {
      GET: async () => {
        const storageKey = deriveStorageKey(envVar('SUPABASE_URL'));

        // Realistic sessions are small, but provider/identity tokens routinely push
        // past MAX_CHUNK_SIZE (3180). Pad so the library MUST chunk → exercises the
        // sb-…-auth-token.0 / .1 split the audit flagged as untested.
        const session = {
          access_token: `eyJhbGciOiJIUzI1NiJ9.${'A'.repeat(4000)}.sig`,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 9999999999,
          refresh_token: 'fake-refresh-token',
          user: { id: 'spike-user-0001', email: 'spike@example.com' },
        };

        // Exactly how @supabase/ssr's applyServerStorage stores it.
        const cookieValue = `base64-${stringToBase64URL(JSON.stringify(session))}`;
        const chunks = createChunks(storageKey, cookieValue);

        // The library's own defaults (httpOnly:false, sameSite:lax, path:/, 400d),
        // + secure for prod — i.e. the attributes stock @supabase/ssr emits.
        const opts = { ...DEFAULT_COOKIE_OPTIONS, secure: true };

        // Write each chunk via TanStack Start's framework cookie API (the path the
        // real auth/callback setAll adapter would call) — proves it emits multiple
        // Set-Cookie headers on workerd.
        for (const c of chunks) {
          setCookie(c.name, c.value, opts as any);
        }

        return Response.json({
          writeMethod: 'TanStack setCookie',
          storageKey,
          maxChunkSize: MAX_CHUNK_SIZE,
          sessionJsonLength: JSON.stringify(session).length,
          cookieValueLength: cookieValue.length,
          chunked: chunks.length > 1,
          chunkCount: chunks.length,
          chunks: chunks.map((c) => ({ name: c.name, length: c.value.length })),
          cookieOptions: opts,
          note: 'Set-Cookie headers on THIS response are emitted by TanStack setCookie; replay them as a Cookie header on /api/probe to verify the chunked read reassembles.',
        });
      },
    },
  },
});
