// Area C (unit #3) — client-only PostHog init for the TanStack Start / Cloudflare
// build. Mirrors the live app's src/lib/analytics.ts init options, but sources the
// key from `import.meta.env.VITE_POSTHOG_KEY`: Vite inlines `VITE_*` at build time,
// whereas `process.env.NEXT_PUBLIC_*` is NOT inlined by Vite (conventions.md
// LANDMINE #2). No key ⇒ returns undefined (no-op) so a fork without analytics
// still boots cleanly.
import posthog, { type PostHog } from 'posthog-js';

// PostHog Cloud US — the default endpoint when VITE_POSTHOG_HOST is unset.
const DEFAULT_API_HOST = 'https://us.i.posthog.com';

export function loadPosthog(): PostHog | undefined {
  // Client-only: posthog touches window/document and must never run during the
  // workerd SSR render.
  if (typeof window === 'undefined') return undefined;

  const key = import.meta.env.VITE_POSTHOG_KEY;
  // No key ⇒ no-op (forkable). The host is optional and falls back to Cloud US.
  if (!key) return undefined;

  const apiHost = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_API_HOST;

  posthog.init(key, {
    api_host: apiHost,
    capture_performance: true, // Autocapture web vitals (LCP, FCP, CLS, INP)
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug(); // debug mode in development
    },
  });

  // Catch unhandled promise rejections from the PostHog recorder on iOS Safari.
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message === 'Load failed' && event.reason?.stack?.includes('recorder.js')) {
      event.preventDefault(); // Prevent the error from being logged
    }
  });

  return posthog;
}
