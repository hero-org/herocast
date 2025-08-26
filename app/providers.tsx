'use client';

import '@rainbow-me/rainbowkit/styles.css';
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@/common/hooks/ThemeProvider';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { rainbowKitTheme, config } from '@/common/helpers/rainbowkit';
import { PostHogProvider } from 'posthog-js/react';
import { loadPosthogAnalytics } from '@/lib/analytics';
import { AuthProvider } from '@/common/context/AuthContext';
import { AppHotkeysProvider } from '@/common/components/AppHotkeysProvider';
import { usePathname } from 'next/navigation';

const posthog = loadPosthogAnalytics();

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    posthog?.capture('$pageview');
  }, [pathname]);

  useEffect(() => {
    import('@farcaster/frame-sdk').then((sdk) => {
      sdk.default.actions.ready();
    });
  }, []);

  const content = (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>
          <AuthProvider>
            <AppHotkeysProvider>
              {children}
            </AppHotkeysProvider>
          </AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content}
    </ThemeProvider>
  );
}