import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import type { PropsWithChildren } from 'react';
import { WagmiProvider } from 'wagmi';
import { config, rainbowKitTheme } from '@/common/helpers/rainbowkit';

// Wallet stack for the TanStack tree (Unit #3 / #754, Area B) — a faithful port of the
// 14-line app/WalletProviders.tsx wrapper: WagmiProvider + RainbowKitProvider over the
// SHARED wagmi `config` and `rainbowKitTheme` (@/common/helpers/rainbowkit, reused via the
// #2 build alias). The config itself is NOT duplicated here.
//
// SSR safety (landmine #3, this unit): wagmi/rainbowkit cannot render on workerd, so this
// component is mounted client-only by Area A via dynamic(ssr:false) and kept route-scoped
// (`needsWallet`). It therefore never enters the server graph. This file has no top-level
// server-incompatible side effects of its own — the only module-scope work is the
// rainbowkit CSS import (a style side effect, deduped by the bundler with the same import
// inside the shared helper).
//
// The Next `'use client'` directive is intentionally dropped: the Vite/TanStack pipeline
// has no RSC boundary, and the sibling Phase-1 Providers.tsx omits it too. `PropsWithChildren`
// is imported as a type (verbatimModuleSyntax) rather than referenced via a global `React`
// namespace, which the TanStack tsconfig (`types: ["vite/client"]`) does not provide.
export default function WalletProviders({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider theme={rainbowKitTheme}>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
