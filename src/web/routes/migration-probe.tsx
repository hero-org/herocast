// THROWAWAY / INTERNAL. The Phase 1 migration vertical-slice probe.
//
// Named `migration-probe` so it reads as internal and is deleted before/at cutover.
// NOTE: the filename must NOT start with `_` — a leading underscore is TanStack's
// pathless/layout-route convention, which would mount this at `/` instead of at a
// literal `/migration-probe` URL.
// It exists to PROVE the workerd path end-to-end during SSR: the loader runs BOTH
// server fns in parallel on the Worker, so the initial HTML is server-rendered from
// real Neynar + Supabase calls (not a client fetch). It MUST render gracefully when
// secrets are absent — no throw, just the empty/null state (proves forkability).
import { createFileRoute } from '@tanstack/react-router';
// getUserFn is owned by another agent (see docs/migration/phase-1.md §4.9). Keep this
// import path/name EXACT — it is a server fn returning the GetUserResult envelope.
import { getUserFn } from '@/web/lib/getUser';
import { getTrendingFn } from '@/web/lib/trending';

type TrendingData = Awaited<ReturnType<typeof getTrendingFn>>;
type AuthData = Awaited<ReturnType<typeof getUserFn>>;

export const Route = createFileRoute('/migration-probe')({
  // SSR loader — runs on workerd. Both server fns fire in parallel.
  loader: async () => {
    const [trending, auth] = await Promise.all([getTrendingFn(), getUserFn()]);
    return { trending, auth };
  },
  component: MigrationProbe,
});

function MigrationProbe() {
  const { trending, auth } = Route.useLoaderData() as { trending: TrendingData; auth: AuthData };

  const casts = trending?.casts ?? [];
  // Defensive reads: the auth envelope is owned by another module; never assume shape.
  const a = (auth ?? {}) as Partial<{
    sessionCookieMatched: boolean;
    networkValidationAttempted: boolean;
    user: { id: string; email?: string | null } | null;
  }>;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 24, lineHeight: 1.5 }}>
      <h1>herocast → TanStack Start on Cloudflare Workers — migration probe</h1>
      <p>
        <small>
          Internal / throwaway. SSR loader runs <code>getTrendingFn</code> + <code>getUserFn</code> in parallel on
          workerd. Renders an empty state when secrets are absent.
        </small>
      </p>

      <h2>
        Trending feed{' '}
        <small>
          (source: <code>{trending?.source ?? 'n/a'}</code>, cache: <code>{trending?.cacheStatus ?? 'n/a'}</code>)
        </small>
      </h2>
      {trending?.sdkError ? (
        <p style={{ color: '#b00' }}>
          Neynar SDK threw → fell back to REST. First line: <code>{trending.sdkError.split('\n')[0]}</code>
        </p>
      ) : null}
      {casts.length === 0 ? (
        <p style={{ color: '#666' }}>No casts (no Neynar key configured, or empty feed).</p>
      ) : (
        <ol>
          {casts.map((c, i) => (
            <li key={c.hash || i}>
              <strong>@{c.author.username || c.author.displayName || 'unknown'}</strong>:{' '}
              {c.text.replace(/\s+/g, ' ').slice(0, 120)}
            </li>
          ))}
        </ol>
      )}

      <h2>Evidence panel</h2>
      <ul>
        <li>
          trending cacheStatus: <code>{trending?.cacheStatus ?? 'n/a'}</code>
        </li>
        <li>
          auth.sessionCookieMatched: <code>{String(a.sessionCookieMatched ?? false)}</code>
        </li>
        <li>
          auth.networkValidationAttempted: <code>{String(a.networkValidationAttempted ?? false)}</code>
        </li>
        <li>
          auth.user: <code>{a.user ? a.user.id : 'null (no valid session)'}</code>
        </li>
      </ul>
    </main>
  );
}
