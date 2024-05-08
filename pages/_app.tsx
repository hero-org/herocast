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

const posthog = loadPosthogAnalytics();
const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const supabaseClient = createClient();
  const { pathname } = router;

  useEffect(() => {
    const handleRouteChange = () => posthog?.capture("$pageview");
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    console.log("_app useEffect", JSON.stringify(router));
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      const isLoggedInUser = !!session;
      const shouldForwardLoggedInUser = includes(["/", "/login"], pathname);
      const shouldForwardLoggedOutUser =
        pathname !== "/login" &&
        pathname.startsWith("/profile") &&
        pathname.startsWith("/cast");

      console.log(
        "_app isLoggedInUser",
        isLoggedInUser,
        "shouldForwardLoggedInUser",
        shouldForwardLoggedInUser,
        "shouldForwardLoggedOutUser",
        shouldForwardLoggedOutUser
      );
      if (isLoggedInUser && shouldForwardLoggedInUser) {
        console.log("_app pushing /feed");
        router.push("/feed");
      } else if (!isLoggedInUser && shouldForwardLoggedOutUser) {
        console.log("_app pushing /login");
        router.push("/login");
      }
    });
  }, [pathname]);

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
