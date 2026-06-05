import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { ProvidersStatus } from '@/components/ProvidersStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import Image from '@/components/ui/image';
import { getUserFromRequest } from '@/lib/supabase/server';

// SSR proof on workerd: read the Supabase session from the request cookie (the
// spike's Q3 read path) inside a server fn, so the shell renders server-resolved
// auth state. Never throws — getUserFromRequest degrades to no-session if secrets
// are unset, so the shell still paints for a fresh fork.
const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  const { user, error } = await getUserFromRequest(request);
  return {
    signedIn: Boolean(user),
    userId: user?.id ?? null,
    authReadStatus: user ? 'session decoded' : error ? error.name : 'no session',
  };
});

export const Route = createFileRoute('/')({
  loader: async () => ({ session: await getSessionFn() }),
  component: Home,
});

const NAV = ['Feeds', 'Inbox', 'Channels', 'Profile'];

function Home() {
  const { session } = Route.useLoaderData();

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-6">
          {/* font-display = Satoshi — proves the local @font-face loaded */}
          <span className="font-display text-2xl font-bold tracking-tight">herocast</span>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <span
                key={item}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </nav>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-channel">
          Track B · Phase 1 · Foundation
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          TanStack Start on Cloudflare Workers
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          herocast’s framework migration shell (
          <a
            href="https://github.com/hero-org/herocast/issues/754"
            className="text-info underline-offset-2 hover:underline"
          >
            #754
          </a>
          ). SSR on workerd with providers, fonts, and the Supabase auth read path
          wired. Pages and API routes land in Phases 2–3.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Providers wired</h2>
          <div className="mt-2">
            <ProvidersStatus />
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Server-side auth read (SSR on workerd)</h2>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Supabase <code className="font-mono text-xs">getUser()</code> from request cookie
            </span>
            <span className="flex items-center gap-2 font-mono text-xs">
              <span
                className={`h-2 w-2 rounded-full ${session.signedIn ? 'bg-success' : 'bg-pending'}`}
                aria-hidden="true"
              />
              {session.authReadStatus}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {session.signedIn
              ? `Signed in as ${session.userId}`
              : 'No session cookie — expected for a fresh shell. The read path still ran on the edge.'}
          </p>
        </section>

        <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Typography (next/font → self-hosted)</h2>
          <div className="mt-3 space-y-2">
            <p className="font-sans text-lg">
              Inter (<code className="font-mono text-xs">--font-sans</code>) — the quick brown fox
            </p>
            <p className="font-display text-lg font-bold">
              Satoshi (--font-display) — the quick brown fox
            </p>
            <p className="font-mono text-sm">
              JetBrains Mono (--font-mono) — const fox = () =&gt; 42;
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">next/image replacement primitive</h2>
          <div className="mt-3 flex items-center gap-3">
            {/* @/components/ui/image — plain <img> wrapper that replaces next/image */}
            <Image src="/images/logo.png" alt="herocast logo" width={32} height={32} />
            <span className="text-sm text-muted-foreground">
              rendered via <code className="font-mono text-xs">@/components/ui/image</code>
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
