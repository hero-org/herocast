import '../src/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

import React, { useState, useEffect, Suspense } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '../src/common/hooks/ThemeProvider';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { rainbowKitTheme, config } from '../src/common/helpers/rainbowkit';
import { PostHogProvider } from 'posthog-js/react';
import { loadPosthogAnalytics } from '../src/lib/analytics';
import { useRouter } from 'next/router';
import localFont from 'next/font/local';

// Dynamic import with safe hydration
import dynamic from 'next/dynamic';

// Import CommandPalette directly - no dynamic import needed
import CommandPalette from '../src/common/components/CommandPalette';
import Home from '../src/home';
import { AuthProvider } from '@/common/context/AuthContext';
import { cn } from '@/lib/utils';
import { PerfPanel } from '../src/common/components/PerfPanel';
import { GlobalHotkeys } from '../src/common/components/GlobalHotkeys';
import { AppHotkeysProvider } from '../src/common/components/AppHotkeysProvider';

const satoshi = localFont({
  src: [
    {
      path: '../src/assets/fonts/Satoshi-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../src/assets/fonts/Satoshi-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../src/assets/fonts/Satoshi-Italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../src/assets/fonts/Satoshi-BoldItalic.woff2',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../src/assets/fonts/Satoshi-MediumItalic.woff2',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../src/assets/fonts/Satoshi-Medium.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
});

const posthog = loadPosthogAnalytics();

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const handleRouteChange = () => posthog?.capture('$pageview');
    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, []);

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
              <GlobalHotkeys />
              <CommandPalette />
              <PerfPanel />
              <Home>
                <Component {...pageProps} />
              </Home>
            </AppHotkeysProvider>
          </AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );

  const children = (
    <main
      className={cn(satoshi.className)}
      style={{
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        WebkitScrollbar: 'none',
      }}
    >
      {posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content}
    </main>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <Head>
        <title>herocast</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      {children}
    </ThemeProvider>
  );
}
