// PLACEHOLDER — replaced wholesale by unit #9 (auth + accounts + onboarding).
//
// Why it exists now (unit #5): the shared AuthContext client-redirects every logged-out
// visitor on a shell route to `/login` (see src/common/context/AuthContext.tsx). Without
// a matching route the canary dead-ends in the router's default not-found — this gives
// the redirect a deterministic, honest landing page. Outside the `_app` pathless layout,
// like app/(auth)/ in the Next tree (and `Home` early-returns children for /login).
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  component: LoginPlaceholder,
});

function LoginPlaceholder() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-bold text-foreground">herocast</h1>
        <p className="text-sm text-muted-foreground">
          Login has not been ported to this preview yet (migration unit #9). Use the live app at{' '}
          <a className="underline text-foreground" href="https://app.herocast.xyz/login">
            app.herocast.xyz
          </a>{' '}
          to sign in.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link className="underline text-foreground" to="/shell-probe">
            View the ported app shell (shell-probe)
          </Link>
        </p>
      </div>
    </main>
  );
}
