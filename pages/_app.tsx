import "../src/globals.css";
import "@rainbow-me/rainbowkit/styles.css";

import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import { ThemeProvider } from "../src/common/hooks/ThemeProvider";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import CommandPalette from "../src/common/components/CommandPalette";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { rainbowKitTheme, config } from "../src/common/helpers/rainbowkit";
import Home from "../src/home";
import { PostHogProvider } from "posthog-js/react";
import { loadPosthogAnalytics } from "../src/lib/analytics";
import { useRouter } from "next/router";

const posthog = loadPosthogAnalytics();

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = () => posthog?.capture("$pageview");
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, []);

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

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
