'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { PostHogProvider } from 'posthog-js/react';
import type React from 'react';
import { useEffect } from 'react';
import { AppHotkeysProvider } from '@/common/components/AppHotkeysProvider';
import { AuthProvider } from '@/common/context/AuthContext';
import { ThemeProvider } from '@/common/hooks/ThemeProvider';
import { useNavigationPerf } from '@/common/hooks/useNavigationPerf';
import { loadPosthogAnalytics } from '@/lib/analytics';

const WalletProviders = dynamic(() => import('./WalletProviders'), {
  ssr: false,
  loading: () => null,
});

const posthog = loadPosthogAnalytics();

function NavigationPerfTracker() {
  useNavigationPerf();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    posthog?.capture('$pageview');
  }, [pathname]);

  useEffect(() => {
    import('@farcaster/frame-sdk').then((sdk) => {
      sdk.default.actions.ready();
    });
  }, []);

  const content = (
    <WalletProviders>
      <AuthProvider>
        <AppHotkeysProvider>
          <NavigationPerfTracker />
          {children}
        </AppHotkeysProvider>
      </AuthProvider>
    </WalletProviders>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content}
    </ThemeProvider>
  );
}
