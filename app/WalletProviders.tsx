'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { config, rainbowKitTheme } from '@/common/helpers/rainbowkit';

export default function WalletProviders({ children }: React.PropsWithChildren) {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider theme={rainbowKitTheme}>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
