import '@rainbow-me/rainbowkit/styles.css';
import {
    getDefaultWallets,
    midnightTheme,
} from '@rainbow-me/rainbowkit';
import { configureChains, createConfig } from 'wagmi';
import {
    optimism,
} from 'wagmi/chains';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';

export const { chains, publicClient } = configureChains(
    [optimism],
    [
        alchemyProvider({ apiKey: import.meta.env.VITE_ALCHEMY_API_KEY }),
        // publicProvider()
    ]
);

const { connectors } = getDefaultWallets({
    appName: 'herocast',
    projectId: 'b34f1019e33e832831871e41741f13fc',
    chains
});

export const wagmiConfig = createConfig({
    autoConnect: true,
    connectors,
    publicClient
})

export const rainbowKitTheme = midnightTheme({
    accentColorForeground: 'white',
    borderRadius: 'small',
    fontStack: 'system',
});