import '@rainbow-me/rainbowkit/styles.css';
import { Chains } from '@paywithglide/glide-js';
import { getDefaultConfig, midnightTheme } from '@rainbow-me/rainbowkit';
import { createConfig, http } from '@wagmi/core';
import { arbitrum, base, mainnet, optimism, polygon, zora } from '@wagmi/core/chains';
import { createPublicClient } from 'viem';
import { isDev } from './env';

// Host-agnostic public key read (#754 unit #9). Vite does NOT inline `NEXT_PUBLIC_*`, so
// under the TanStack/Vite build this must come from `import.meta.env.VITE_ALCHEMY_API_KEY`
// (else the transports resolve to `…/v2/undefined` and every RPC fails). The live
// Next/webpack build has no `import.meta.env` (it is `undefined` there) — the `?.` keeps
// that from throwing at module load and falls back to `process.env.NEXT_PUBLIC_*`, which
// `next build` inlines. `import.meta as any` keeps the root-tsconfig `pnpm typecheck` green
// (it has no `vite/client` types). Public value, never a secret.
const alchemyApiKey = (import.meta as any).env?.VITE_ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const optimismHttp = http(`https://opt-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
const mainnetHttp = http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
const baseHttp = http(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
const arbitrumHttp = http(`https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
const polygonHttp = http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);

export const publicClient = createPublicClient({
  chain: optimism,
  transport: optimismHttp,
});

export const publicClientTestnet = createPublicClient({
  chain: Chains.OptimismTestnet,
  transport: http(),
});

export const config = getDefaultConfig({
  appName: 'herocast',
  projectId: 'b34f1019e33e832831871e41741f13fc',
  chains: isDev()
    ? [mainnet, optimism, Chains.OptimismTestnet, Chains.BaseTestnet]
    : [optimism, mainnet, base, arbitrum, polygon, zora],
  ssr: true,
  transports: {
    [optimism.id]: optimismHttp,
    [mainnet.id]: mainnetHttp,
    [base.id]: baseHttp,
    [arbitrum.id]: arbitrumHttp,
    [polygon.id]: polygonHttp,
    [zora.id]: http(), // Alchemy doesn't support Zora, use default
  },
});

export const mainnetConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: mainnetHttp,
  },
});

export const rainbowKitTheme = midnightTheme({
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
});
