import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, midnightTheme } from "@rainbow-me/rainbowkit";
import { optimism, mainnet, base, arbitrum, polygon, zora } from "@wagmi/core/chains";
import { createPublicClient } from "viem";
import { isDev } from "./env";
import { Chains } from "@paywithglide/glide-js";
import { http, createConfig } from "@wagmi/core";

const optimismHttp = http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`);

const mainnetHttp = http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`);

export const publicClient = createPublicClient({
    chain: optimism,
    transport: optimismHttp,
});

export const publicClientTestnet = createPublicClient({
    chain: Chains.OptimismTestnet,
    transport: http(),
});

export const config = getDefaultConfig({
    appName: "herocast",
    projectId: "b34f1019e33e832831871e41741f13fc",
    chains: isDev()
        ? [mainnet, optimism, Chains.OptimismTestnet, Chains.BaseTestnet]
        : [optimism, mainnet, base, arbitrum, polygon, zora],
    ssr: true,
});

export const mainnetConfig = createConfig({
    chains: [mainnet],
    transports: {
        [mainnet.id]: mainnetHttp,
    },
});

export const rainbowKitTheme = midnightTheme({
    accentColorForeground: "white",
    borderRadius: "medium",
    fontStack: "system",
});
