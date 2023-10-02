import React from "react";

import '@rainbow-me/rainbowkit/styles.css';
import {
    ConnectButton,
    getDefaultWallets,
    midnightTheme,
    RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import {
    optimism,
} from 'wagmi/chains';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';

const { chains, publicClient } = configureChains(
    [optimism],
    [
        //   alchemyProvider({ apiKey: process.env.ALCHEMY_ID }),
        publicProvider()
    ]
);

const { connectors } = getDefaultWallets({
    appName: 'herocast',
    projectId: 'b34f1019e33e832831871e41741f13fc',
    chains
});

const wagmiConfig = createConfig({
    autoConnect: true,
    connectors,
    publicClient
})

const WalletLogin = () => {
    return (<WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider chains={chains} theme={midnightTheme({
            accentColorForeground: 'white',
            borderRadius: 'small',
            fontStack: 'system',
        })}>
            <span className="block mb-2 text-lg font-medium leading-6 text-gray-100">
                Connected wallet
            </span>
            <ConnectButton showBalance={false} chainStatus="none" />
        </RainbowKitProvider>
    </WagmiConfig>)
}

export default WalletLogin;