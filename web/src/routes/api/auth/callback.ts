import { createFileRoute } from '@tanstack/react-router';
import { createServerClientWritable } from '@/lib/supabase/server';

// GET /api/auth/callback — Supabase OAuth/PKCE login callback. Faithful port of
// app/api/auth/callback/route.ts onto a TanStack Start server route handler:
//   read `code` -> exchangeCodeForSession -> @supabase/ssr writes the (chunked)
//   session cookies via setAll -> TanStack Start setCookie -> Set-Cookie on the 302.
// This is the write path the Phase-0.5 spike proved on workerd.
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
        // Constrain `next` to a same-origin path (blocks protocol-relative open
        // redirects); defaults to '/'. The Next original passed it through unguarded.
        const rawNext = searchParams.get('next') ?? '/';
        const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
        const errorRedirect = `${origin}/auth/auth-code-error`;

        try {
          if (code) {
            const supabase = createServerClientWritable(request);
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              // On Cloudflare Workers the WHATWG URL `origin` is authoritative for both
              // dev and prod. The Next original also honored `X-Forwarded-Host` for the
              // Vercel load balancer — but on a bare Worker there is NO trusted LB to
              // overwrite that header, so trusting it would be an open redirect (a request
              // with `X-Forwarded-Host: evil.com` after a valid code exchange → off-origin).
              // We deliberately drop it. (If a multi-host setup needs it later, validate
              // against an allowlist/PUBLIC_URL secret before use.)
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
