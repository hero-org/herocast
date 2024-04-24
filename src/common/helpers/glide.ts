import { createGlideClient } from "@paywithglide/glide-js";
import { mainnet, base, optimism, polygon, arbitrum } from "@wagmi/core/chains";

export const glideClient = createGlideClient({
  projectId: process.env.NEXT_PUBLIC_GLIDE_PROJECT_ID || "",
  chains: [optimism, mainnet, base, arbitrum, polygon],
});
