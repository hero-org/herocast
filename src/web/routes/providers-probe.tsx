// THROWAWAY / INTERNAL — unit #3 (provider tree) probe. Deleted at/before cutover.
//
// Exercises the mounted provider tree end-to-end under SSR on workerd:
//   - next-themes useTheme(): light/dark toggle + the persisted class on <html>
//   - a React Query useQuery on a persisted root ('feeds') → written to IDB and
//     restored on reload (PersistQueryClientProvider + the reused @/lib/queryPersister)
//   - loadPosthog() readout: whether VITE_POSTHOG_KEY is set + posthog initialized
//
// SSR-safe: the theme + posthog reads are deferred to a mounted effect (no
// window/localStorage during the server render), and the query renders its pending
// state on the server then fetches on the client — so hydration matches.
//
// NOTE: the filename must NOT start with `_` — a leading underscore is TanStack's
// pathless/layout-route convention and would mount this at `/` instead of
// /providers-probe. Mirrors nav-probe.tsx / migration-probe.tsx.
//
// The `createFileRoute('/providers-probe')` literal type-errors under web:typecheck
// until the integrator regenerates the gitignored routeTree.gen.ts via web:build
// (same precedent as nav-probe when it was first authored).
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { loadPosthog } from '@/web/lib/analytics';

export const Route = createFileRoute('/providers-probe')({
  component: ProvidersProbe,
});

// A persisted-root query (root 'feeds' is in the persister's allow-list), so a
// successful result is written to IDB and restored on the next cold load. The
// payload is created once per real fetch and never goes stale (staleTime: Infinity),
// so a value that survives a reload proves the restore-from-IDB path.
function useProbeQuery() {
  return useQuery({
    queryKey: ['feeds', 'providers-probe'],
    queryFn: async () => ({ value: Math.random().toString(36).slice(2, 10), fetchedAt: Date.now() }),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

function ProvidersProbe() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [posthogReady, setPosthogReady] = useState(false);
  const query = useProbeQuery();

  // next-themes + posthog both read window/localStorage → defer to the client to
  // stay SSR-safe and avoid a hydration mismatch on the theme/posthog readouts.
  useEffect(() => {
    setMounted(true);
    setPosthogReady(Boolean(loadPosthog()));
  }, []);

  const hasPosthogKey = Boolean(import.meta.env.VITE_POSTHOG_KEY);
  const value = query.data?.value;
  const fetchedAt = query.data?.fetchedAt;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, lineHeight: 1.5 }}>
      <h1>provider-tree probe</h1>
      <p>
        <small>
          Internal / throwaway. Exercises <code>next-themes</code> + a persisted <code>React Query</code> (IDB) +{' '}
          <code>posthog</code> presence through the mounted provider tree.
        </small>
      </p>

      <h2>Theme (next-themes)</h2>
      <p>
        current: <code>{mounted ? `${theme} (resolved: ${resolvedTheme})` : '(hydrating…)'}</code>
      </p>
      <p>
        <button type="button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          toggle light / dark
        </button>
      </p>

      <h2>Persisted query (React Query → IndexedDB)</h2>
      <ul>
        <li>
          status: <code>{query.status}</code>
        </li>
        <li>
          value (stable across reloads ⇒ restored from IDB): <code>{value ?? '(loading…)'}</code>
        </li>
        <li>
          fetchedAt: <code>{fetchedAt ? new Date(fetchedAt).toISOString() : 'n/a'}</code>
        </li>
        <li>
          dataUpdatedAt: <code>{query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : 'n/a'}</code>
        </li>
      </ul>

      <h2>PostHog</h2>
      <ul>
        <li>
          VITE_POSTHOG_KEY set: <code>{String(hasPosthogKey)}</code>
        </li>
        <li>
          posthog initialized: <code>{mounted ? String(posthogReady) : '(checking…)'}</code>
        </li>
      </ul>
    </main>
  );
}
