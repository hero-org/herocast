import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, midnightTheme } from "@rainbow-me/rainbowkit";
import { optimism } from "@wagmi/core/chains";
import { http, createConfig } from "@wagmi/core";

export const wagmiConfig = createConfig({
  chains: [optimism],
  transports: {
    [optimism.id]: http(
      `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    ),
  },
});

export const config = getDefaultConfig({
  appName: "herocast",
  projectId: "b34f1019e33e832831871e41741f13fc",
  chains: [optimism],
});

export const rainbowKitTheme = midnightTheme({
  accentColorForeground: "white",
  borderRadius: "small",
  fontStack: "system",
});
