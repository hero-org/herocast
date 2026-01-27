'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { config, rainbowKitTheme } from '@/common/helpers/rainbowkit';
import { getQueryClient } from '@/lib/queryClient';

const isDev = process.env.NODE_ENV === 'development';

// Lazy load devtools only in development to reduce production bundle
const ReactQueryDevtools = isDev
  ? lazy(() => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })))
  : () => null;

export default function WalletProviders({ children }: React.PropsWithChildren) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>{children}</RainbowKitProvider>
        {isDev && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
          </Suspense>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
