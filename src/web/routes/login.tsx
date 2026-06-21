// Unit #9 (#754 auth/accounts) — the real login route, replacing the unit-#5 placeholder.
// Outside the `_app` pathless layout (the auth tier has no app chrome, like the Next
// `(auth)` group), so `Home`'s `/login` early-return is never even reached here — this
// route simply doesn't mount the shell. The ported surface lives in `@/web/pages/LoginPage`
// (the established thin-route → page pattern). The OAuth WRITE round-trip it drives runs
// through routes/api/auth/callback.ts (the 302 callback) + supabase/server.server.ts.
import { createFileRoute } from '@tanstack/react-router';
import LoginPage from '@/web/pages/LoginPage';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});
