import { createFileRoute } from '@tanstack/react-router';
import { createSupabaseWriteClient } from '@/web/lib/supabase/server.server';

// GET /api/auth/callback — Supabase OAuth/PKCE login callback. Port of
// app/api/auth/callback/route.ts onto a TanStack Start server route handler:
//   read `code` -> exchangeCodeForSession (WRITE client) -> @supabase/ssr writes the
//   (chunked) session cookies via setAll -> TanStack Start setCookie -> Set-Cookie on
//   the 302. This is the write path the Phase-0.5 spike proved on workerd.
//
// LOAD-BEARING: this MUST return a 302 (not 200 JSON). TanStack Start merges the
// ambient Set-Cookie headers onto the handler Response ONLY when it is non-2xx, so a
// redirect is the only shape that lets the chunked sb-* cookies persist.
//
// NOTE (Phase 1): the redirect targets (`next` default '/', and /auth/auth-code-error)
// don't exist as routes yet — they land with the pages in Phase 2. What this route
// proves now is the exchange + chunked Set-Cookie + redirect mechanics on the edge.
export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams, origin } = new URL(request.url);
        const code = searchParams.get('code');
        // Harden `next`: require a single leading '/' and reject protocol-relative
        // '//evil.com' (open-redirect). Default to '/'. The Next original passed it
        // through unguarded.
        const rawNext = searchParams.get('next') ?? '/';
        const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
        const errorRedirect = `${origin}/auth/auth-code-error`;

        try {
          if (code) {
            const supabase = createSupabaseWriteClient(request);
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              // On Cloudflare Workers the WHATWG URL `origin` is authoritative for
              // both dev and prod. The Next original also honored `X-Forwarded-Host`
              // for the Vercel LB — but on a bare Worker there is NO trusted LB to
              // overwrite that header, so trusting it would be an open redirect
              // (`X-Forwarded-Host: evil.com` after a valid exchange -> off-origin).
              // We deliberately drop it.
              return Response.redirect(`${origin}${next}`, 302);
            }
          }
          return Response.redirect(errorRedirect, 302);
        } catch (e) {
          console.error('Error in auth callback:', e);
          return Response.redirect(errorRedirect, 302);
        }
      },
    },
  },
});
