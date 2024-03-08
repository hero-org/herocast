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
import { PostHogProvider } from 'posthog-js/react'
import { loadPosthogAnalytics } from "../src/lib/analytics";
import "../src/globals.css";
import "@rainbow-me/rainbowkit/styles.css";


const posthog = loadPosthogAnalytics();

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
