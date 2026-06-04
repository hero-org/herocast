import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { getTrendingCached } from '../lib/trending';
import { getUserFromRequest, type GetUserResult } from '../lib/getUser';

// process.env is populated per-request on workerd when nodejs_compat is on (vars +
// .dev.vars). Module-scope reads would be undefined, so read inside the handler.
function envVar(key: string): string {
  return (globalThis as any).process?.env?.[key] ?? '';
}

// ── Server fn A (Q1 + Q2): Neynar trending via SDK→REST fallback, cached ───────
const getTrendingFn = createServerFn({ method: 'GET' }).handler(async () => {
  return getTrendingCached(envVar('NEYNAR_API_KEY'), 10);
});

// ── Server fn B (Q3): read the Supabase cookie from the request, call getUser ──
const getUserFn = createServerFn({ method: 'GET' }).handler(async (): Promise<GetUserResult> => {
  const request = getRequest();
  return getUserFromRequest(request, envVar('SUPABASE_URL'), envVar('SUPABASE_ANON_KEY'));
});

export const Route = createFileRoute('/')({
  // The loader runs on workerd during SSR — this is the "server-loaded list".
  loader: async () => {
    const [trending, auth] = await Promise.all([getTrendingFn(), getUserFn()]);
    return { trending, auth };
  },
  component: Home,
});

function Home() {
  const { trending, auth } = Route.useLoaderData();
  return (
    <main style={{ maxWidth: 760, lineHeight: 1.5 }}>
      <h1>herocast → TanStack Start on Cloudflare Workers — Phase 0 spike</h1>

      <h2>
        Q1/Q2 — Trending feed{' '}
        <small>
          (source: <code>{trending.source}</code>, cache: <code>{trending.cacheStatus}</code>)
        </small>
      </h2>
      {trending.sdkError ? (
        <p style={{ color: '#b00' }}>
          Neynar SDK threw → fell back to REST. First line:{' '}
          <code>{trending.sdkError.split('\n')[0]}</code>
        </p>
      ) : (
        <p style={{ color: '#070' }}>Neynar SDK path succeeded on workerd.</p>
      )}
      <ol>
        {trending.sample.map((c) => (
          <li key={c.hash}>
            <strong>@{c.author}</strong>: {c.text}
          </li>
        ))}
      </ol>

      <h2>Q3 — Supabase getUser() from request cookie</h2>
      <ul>
        <li>cookies seen by adapter: {auth.cookiesSeen.length}</li>
        <li>supabase cookies seen: {JSON.stringify(auth.supabaseCookiesSeen)}</li>
        <li>user: {auth.user ? auth.user.id : 'null (no valid session)'}</li>
        <li>getUser error: {auth.error ? `${auth.error.name}: ${auth.error.message}` : 'none'}</li>
      </ul>

      <p>
        <small>Throwaway spike for hero-org/herocast#754. JSON probe: <code>/api/probe</code></small>
      </p>
    </main>
  );
}
