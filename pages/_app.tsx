import React from "react";
import type { AppProps } from "next/app";
import { AptabaseProvider } from "@aptabase/react";
import { ThemeProvider } from "../src/common/hooks/ThemeProvider";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import CommandPalette from "../src/common/components/CommandPalette";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { rainbowKitTheme, config } from "../src/common/helpers/rainbowkit";
import Home from "../src/home";

import "../src/globals.css";
import "@rainbow-me/rainbowkit/styles.css";


import posthog from "posthog-js"
import { PostHogProvider } from 'posthog-js/react'

const loadPosthog = () => {
  if (typeof window !== 'undefined') { // checks that we are client-side
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return;
  
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // loaded: (posthog) => {
      //   if (process.env.NODE_ENV === 'development') posthog.debug() // debug mode in development
      // },
    })
  }
}

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  const children = (
    <PostHogProvider client={posthog}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={rainbowKitTheme}>
            <CommandPalette />
            <Home>
              <Component {...pageProps} />
            </Home>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PostHogProvider>
  );

  const content = process.env.NEXT_PUBLIC_APTABASE_KEY ? (
    <AptabaseProvider appKey={process.env.NEXT_PUBLIC_APTABASE_KEY}>
      {children}
    </AptabaseProvider>
  ) : (
    children
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {content}
    </ThemeProvider>
  );
}
