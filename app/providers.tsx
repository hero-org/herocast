'use client';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { PostHogProvider } from 'posthog-js/react';
import type React from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AppHotkeysProvider } from '@/common/components/AppHotkeysProvider';
import { AuthProvider } from '@/common/context/AuthContext';
import { ThemeProvider } from '@/common/hooks/ThemeProvider';
import { useNavigationPerf } from '@/common/hooks/useNavigationPerf';
import { useWebVitals } from '@/common/hooks/useWebVitals';
import { loadPosthogAnalytics } from '@/lib/analytics';
import { getProviderType } from '@/lib/farcaster/providers';
import { getQueryClient } from '@/lib/queryClient';
import {
  createIDBPersister,
  QUERY_PERSIST_BUSTER,
  QUERY_PERSIST_MAX_AGE,
  shouldPersistQuery,
} from '@/lib/queryPersister';

const WalletProviders = dynamic(() => import('./WalletProviders'), {
  ssr: false,
  loading: () => null,
});

const posthog = loadPosthogAnalytics();

const isDev = process.env.NODE_ENV === 'development';
const ReactQueryDevtools = isDev
  ? lazy(() => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })))
  : () => null;

// Routes that need wallet functionality (wagmi/rainbowkit)
const walletRoutes = ['/accounts', '/welcome/connect', '/settings'];

function NavigationPerfTracker() {
  useNavigationPerf();
  return null;
}

function WebVitalsTracker() {
  useWebVitals();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => getQueryClient());
  const [persister] = useState(() => createIDBPersister());
  // Scope the persisted snapshot to the active provider — neynar/hypersnap share
  // query keys but return different data, so the buster discards a stale
  // provider's snapshot on the next cold start. Read once at mount; provider is
  // seeded synchronously from localStorage so this is correct before hydration.
  const [persistBuster] = useState(() => `${QUERY_PERSIST_BUSTER}-${getProviderType()}`);
  const needsWallet = walletRoutes.some((route) => pathname?.startsWith(route));

  useEffect(() => {
    posthog?.capture('$pageview');
  }, [pathname]);

  useEffect(() => {
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

  const content = (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_PERSIST_MAX_AGE,
        buster: persistBuster,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {needsWallet ? <WalletProviders>{appContent}</WalletProviders> : appContent}
      {isDev && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </Suspense>
      )}
    </PersistQueryClientProvider>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content}
    </ThemeProvider>
  );
}
