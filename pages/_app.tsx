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
import { createClient } from "@/common/helpers/supabase/component";
import includes from "lodash.includes";
import localFont from "next/font/local";

const satoshi = localFont({
  src: [
    {
      path: "../src/assets/fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../src/assets/fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../src/assets/fonts/Satoshi-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../src/assets/fonts/Satoshi-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "../src/assets/fonts/Satoshi-MediumItalic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "../src/assets/fonts/Satoshi-Medium.woff2",
      weight: "600",
      style: "normal",
    },
  ],
});

const posthog = loadPosthogAnalytics();
const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const supabaseClient = createClient();
  const { asPath } = router;

  useEffect(() => {
    const handleRouteChange = () => posthog?.capture("$pageview");
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      const isLoggedInUser = !!session;
      const shouldForwardLoggedInUser = includes(["/", "/login"], asPath);
      const shouldForwardLoggedOutUser =
        asPath !== "/login" &&
        asPath.startsWith("/profile") &&
        asPath.startsWith("/cast");

      if (isLoggedInUser && shouldForwardLoggedInUser) {
        window.location.href = "/feed";
      } else if (!isLoggedInUser && shouldForwardLoggedOutUser) {
        window.location.href = "/login";
      }
    });
  }, [asPath]);

  const children = (
    <main className={satoshi.className}>
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
    </main>
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
