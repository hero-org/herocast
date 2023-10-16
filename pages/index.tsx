
import React from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import Home from './home';
import CommandPalette from '../src/common/components/CommandPalette';
import { Theme } from '@radix-ui/themes';
import '@rainbow-me/rainbowkit/styles.css';
import {
    RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiConfig } from 'wagmi';
import { wagmiConfig, chains, rainbowKitTheme } from "../src/common/helpers/rainbowkit";

const Index = () => (
    <Theme radius="small" appearance="dark">
        <WagmiConfig config={wagmiConfig}>
            <RainbowKitProvider chains={chains} theme={rainbowKitTheme}>
                <CommandPalette />
                <Home />
            </RainbowKitProvider>
        </WagmiConfig>
    </Theme>
);

export default Index;
