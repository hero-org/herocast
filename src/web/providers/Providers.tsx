import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider } from 'next-themes';
import { PostHogProvider } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AppHotkeysProvider } from '@/common/components/AppHotkeysProvider';
import { AuthProvider } from '@/common/context/AuthContext';
import { useNavigationPerf } from '@/common/hooks/useNavigationPerf';
import { useWebVitals } from '@/common/hooks/useWebVitals';
// Area C plumbing (persist + analytics shims). C owns these modules/exports:
//   getPersistOptions(): the FULL PersistQueryClientProvider `persistOptions` — persister,
//     maxAge, dehydrateOptions, AND the provider-scoped `buster`. SSR-safe at the source:
//     getProviderType() self-guards (`typeof window === 'undefined'` → 'neynar'), so no
//     localStorage is read during the workerd render (landmine #1).
//   loadPosthog(): the posthog client on the client (VITE_POSTHOG_KEY set), else undefined.
import { loadPosthog } from '@/web/lib/analytics';
// #2 next/dynamic shim — imported by its real module path (not `next/dynamic`) so
// `web:typecheck` resolves to OUR shim's types, not next's. `ssr:false` ⇒ client-only
// mount-after-hydration (wagmi/rainbowkit can't render on workerd).
import dynamic from '@/web/lib/dynamic';
import { usePathname } from '@/web/lib/navigation';
import { getQueryClient } from '@/web/lib/queryClient';
import { getPersistOptions } from '@/web/lib/queryPersist';

// Full provider tree for the TanStack-on-Cloudflare app — ported from app/providers.tsx,
// SSR-safe on workerd + React 19. Nesting (outer → inner):
//
//   ThemeProvider (next-themes)
//     └ PostHogProvider (only when posthog initialized)
//         └ PersistQueryClientProvider (+ IDB persister, provider-scoped buster)
//             └ [WalletProviders if needsWallet route] (wagmi/rainbowkit, dynamic ssr:false)
//                 └ AuthProvider (shared src/common; uses next/navigation → #2 adapter)
//                     └ AppHotkeysProvider (shared src/common)
//                         └ NavigationPerfTracker + WebVitalsTracker + children
//
// Side effects: posthog `$pageview` on pathname change; @farcaster/frame-sdk `ready()`
// on mount (dynamic-imported so it never enters the server graph).

// Loaded only on `needsWallet` routes — keeps the wallet bundle out of the main chunk.
const WalletProviders = dynamic<{ children: ReactNode }>(() => import('./WalletProviders'), {
  ssr: false,
  loading: () => null,
});

// Initialized once at module load. SSR (no window): undefined ⇒ tree renders without
// PostHogProvider. Client: the posthog client when VITE_POSTHOG_KEY is set, else undefined.
// PostHogProvider emits no DOM, so the server/client structural difference is hydration-safe.
const posthog = loadPosthog();

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : () => null;

// Routes that need wallet functionality (wagmi/rainbowkit).
const WALLET_ROUTES = ['/accounts', '/welcome/connect', '/settings'];

function NavigationPerfTracker() {
  useNavigationPerf();
  return null;
}

function WebVitalsTracker() {
  useWebVitals();
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Server: fresh client per request. Browser: stable singleton (getQueryClient).
  const [queryClient] = useState(() => getQueryClient());
  // Fully-formed (incl. the SSR-safe provider-scoped buster) from Area C — single owner,
  // no re-compute. LANDMINE #1 is handled at the source (getProviderType self-guards).
  const [persistOptions] = useState(() => getPersistOptions());
  const needsWallet = WALLET_ROUTES.some((route) => pathname?.startsWith(route));

  useEffect(() => {
    posthog?.capture('$pageview');
  }, [pathname]);

  useEffect(() => {
    // Dynamic-import keeps frame-sdk out of the SSR/server graph; ready() is client-only.
    import('@farcaster/frame-sdk').then((sdk) => {
      sdk.default.actions.ready();
    });
  }, []);

  const appContent = (
    <AuthProvider>
      <AppHotkeysProvider>
        <NavigationPerfTracker />
        <WebVitalsTracker />
        {children}
      </AppHotkeysProvider>
    </AuthProvider>
  );

  const persisted = (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {needsWallet ? <WalletProviders>{appContent}</WalletProviders> : appContent}
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </Suspense>
      )}
    </PersistQueryClientProvider>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {posthog ? <PostHogProvider client={posthog}>{persisted}</PostHogProvider> : persisted}
    </ThemeProvider>
  );
}
