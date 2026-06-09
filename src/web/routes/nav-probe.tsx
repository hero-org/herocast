// THROWAWAY / INTERNAL — unit #2 (navigation seam) probe. Deleted at/before cutover.
//
// Proves the next/navigation adapter (Area A) + the next/link shim (Area C) work under
// SSR on workerd. On the initial server render: useParams() resolves, useSearchParams()
// reads ?q= from the URL, and the page is server-rendered (not a client fetch). After
// hydration: a programmatic useRouter().push and an intent-preloaded <Link> both
// navigate. cf-canary: /nav-probe SSR-renders, /nav-probe?q=hi round-trips through
// useSearchParams, and both navigations land.
//
// NOTE: the filename must NOT start with `_` — a leading underscore is TanStack's
// pathless/layout-route convention and would mount this at `/` instead of /nav-probe.
// Mirrors migration-probe.tsx.
import { createFileRoute } from '@tanstack/react-router';
// Area C — the next/link shim (default export). Internal hrefs default to preload="intent".
import Link from '@/web/components/link';
// Area A — the next/navigation drop-in adapter (built in parallel; this import path is
// the agreed seam from conventions.md / phase-2-navigation-seam.md). A sibling-area
// "module not found" error here is expected until Area A lands.
import { useParams, useRouter, useSearchParams } from '@/web/lib/navigation';

export const Route = createFileRoute('/nav-probe')({
  component: NavProbe,
});

function NavProbe() {
  const router = useRouter();
  // useParams (strict:false inside the adapter) resolves to an object for any route —
  // {} for this static route — without throwing, on both server and client.
  const params = useParams();
  // Next-compatible URLSearchParams: .get('q') reads the live query string under SSR.
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, lineHeight: 1.5 }}>
      <h1>nav-seam probe</h1>
      <p>
        <small>
          Internal / throwaway. Exercises <code>useParams</code> + <code>useSearchParams</code> +{' '}
          <code>useRouter().push</code> + the <code>next/link</code> shim through the TanStack adapter.
        </small>
      </p>

      <h2>Evidence panel</h2>
      <ul>
        <li>
          useSearchParams <code>?q=</code>: <code>{q || '(empty)'}</code>
        </li>
        <li>
          useParams: <code>{JSON.stringify(params)}</code>
        </li>
      </ul>

      <h2>Navigations</h2>
      <p>
        <button type="button" onClick={() => router.push('/nav-probe?q=pushed')}>
          router.push(&quot;?q=pushed&quot;)
        </button>
      </p>
      <p>
        {/* Internal href → TanStack <Link> with preload="intent" (the shim default). */}
        <Link href="/nav-probe?q=linked">Link to ?q=linked (intent preload)</Link>
      </p>
    </main>
  );
}
