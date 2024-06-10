import { Chains } from "@paywithglide/glide-js";

export const isDev = (): boolean => {
    return process.env.NODE_ENV === 'development';
}

export const optimismChainId = isDev() ? Chains.OptimismTestnet.id : Chains.Optimism.id;
