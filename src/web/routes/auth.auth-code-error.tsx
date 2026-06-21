// Unit #9 (#754 auth/accounts) — /auth/auth-code-error, the 302 callback's failure
// redirect target. In the Next tree app/auth/auth-code-error is a standalone path (NOT in
// the `(auth)` group), so it sits OUTSIDE both the `_app` shell and the `_auth` layout and
// centers itself. Thin route → `@/web/pages/AuthCodeErrorPage`.
import { createFileRoute } from '@tanstack/react-router';
import AuthCodeErrorPage from '@/web/pages/AuthCodeErrorPage';

export const Route = createFileRoute('/auth/auth-code-error')({
  component: AuthCodeErrorPage,
});
