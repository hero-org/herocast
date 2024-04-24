import { BUNDLER_ADDRESS, bundlerABI } from "@farcaster/hub-web";
import { createGlideClient, Chains } from "@paywithglide/glide-js";
import { encodeFunctionData, toHex } from "viem";
import { WARPCAST_RECOVERY_PROXY } from "./farcaster";
import { RegistrationTransactionData } from "../components/PaymentSelector";
import { PaymentOption } from "node_modules/@paywithglide/glide-js/dist/types";
import { isDev } from "./env";


const chains = isDev() 
  ? [Chains.BaseTestnet, Chains.OptimismTestnet] 
  : [Chains.Optimism, Chains.Ethereum, Chains.Base, Chains.Arbitrum, Chains.Avalanche, Chains.Polygon, Chains.Zora];


export const glideClient = createGlideClient({
  projectId: process.env.NEXT_PUBLIC_GLIDE_PROJECT_ID || "",
  chains,
});

export function getChain(chainAddress: string, property?: string) {
  const [, chainIdStr] = chainAddress.split(':');
  const chain = chains.find((chain) => chain.id === parseInt(chainIdStr));
  if (property && chain && chain[property]) {
    return chain[property];
  }
  return chain
}

export const getGlidePaymentOptions = async ({
  chainId,
  address,
  registerSignature,
  addSignature,
  publicKey,
  metadata,
  deadline,
  price
}: RegistrationTransactionData): Promise<PaymentOption[]> => {
  if (
    !address
    || !registerSignature
    || !publicKey
    || !metadata
    || !deadline
    || !addSignature
    || !price
  ) return [];
    return await glideClient.listPaymentOptions({
      transaction: {
        chainId: `eip155:${chainId}`,
        to: BUNDLER_ADDRESS,
        value: toHex(price),
        input: encodeFunctionData({
          abi: bundlerABI,
          functionName: "register",
          args: [
            {
              to: address,
              recovery: WARPCAST_RECOVERY_PROXY,
              deadline,
              sig: registerSignature
            },
            [
              {
                keyType: 1,
                key: publicKey,
                metadataType: 1,
                metadata,
                sig: addSignature,
                deadline,
              },
            ],
            0n
          ],
        }),
      },
      payerWalletAddress: address,
    });
};

