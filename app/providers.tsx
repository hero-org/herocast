'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { PostHogProvider } from 'posthog-js/react';
import type React from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AppHotkeysProvider } from '@/common/components/AppHotkeysProvider';
import { AuthProvider } from '@/common/context/AuthContext';
import { ThemeProvider } from '@/common/hooks/ThemeProvider';
import { useNavigationPerf } from '@/common/hooks/useNavigationPerf';
import { loadPosthogAnalytics } from '@/lib/analytics';
import { getQueryClient } from '@/lib/queryClient';

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

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => getQueryClient());
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
        {children}
      </AppHotkeysProvider>
    </AuthProvider>
  );

  const content = (
    <QueryClientProvider client={queryClient}>
      {needsWallet ? <WalletProviders>{appContent}</WalletProviders> : appContent}
      {isDev && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </Suspense>
      )}
    </QueryClientProvider>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content}
    </ThemeProvider>
  );
}
