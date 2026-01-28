import '@rainbow-me/rainbowkit/styles.css';
import { Chains } from '@paywithglide/glide-js';
import { getDefaultConfig, midnightTheme } from '@rainbow-me/rainbowkit';
import { createConfig, http } from '@wagmi/core';
import { arbitrum, base, mainnet, optimism, polygon, zora } from '@wagmi/core/chains';
import { createPublicClient } from 'viem';
import { isDev } from './env';

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

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
