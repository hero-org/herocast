'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/common/hooks/ThemeProvider';
import { PostHogProvider } from 'posthog-js/react';
import { loadPosthogAnalytics } from '@/lib/analytics';
import { AuthProvider } from '@/common/context/AuthContext';
import { AppHotkeysProvider } from '@/common/components/AppHotkeysProvider';
import { usePathname } from 'next/navigation';

const WalletProviders = dynamic(() => import('./WalletProviders'), {
  ssr: false,
  loading: () => null,
});

const posthog = loadPosthogAnalytics();

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
        <AppHotkeysProvider>{children}</AppHotkeysProvider>
      </AuthProvider>
    </WalletProviders>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content}
    </ThemeProvider>
  );
}
