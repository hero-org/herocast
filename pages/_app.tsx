import React from 'react';
import type { AppProps } from 'next/app'
import { AptabaseProvider } from '@aptabase/react';
import { ThemeProvider } from '../src/common/hooks/ThemeProvider';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import CommandPalette from '../src/common/components/CommandPalette';
import { wagmiConfig, chains, rainbowKitTheme } from "../src/common/helpers/rainbowkit";
import Home from './home/index';

import '../../src/globals.css';
import '@rainbow-me/rainbowkit/styles.css';


export default function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <AptabaseProvider appKey={process.env.NEXT_PUBLIC_APTABASE_KEY!}>
                <WagmiConfig config={wagmiConfig}>
                    <RainbowKitProvider chains={chains} theme={rainbowKitTheme}>
                        <CommandPalette />
                        <Home>
                            <Component {...pageProps} />
                        </Home>
                    </RainbowKitProvider>
                </WagmiConfig>,
            </AptabaseProvider>
        </ThemeProvider>
    )
}