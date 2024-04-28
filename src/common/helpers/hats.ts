import {
  HatsClient,
  treeIdToTopHatId,
  hatIdDecimalToHex,
  hatIdHexToDecimal,
} from "@hatsprotocol/sdk-v1-core";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { optimism } from "viem/chains";
import type { PublicClient } from "viem";

export function createHatsClient(chainId: number): HatsClient {
  const localPublicClient = createPublicClient({
    chain: optimism,
    transport: http(`http://127.0.0.1:8545`),
  });

  const localWalletClient = createWalletClient({
    chain: optimism,
    transport: custom(window.ethereum),
  });

  const hatsClient = new HatsClient({
    chainId: 10,
    publicClient: localPublicClient as PublicClient,
    walletClient: localWalletClient,
  });

  return hatsClient;
}

export async function createInitialTree(
  account: `0x${string}`,
  topHatWearer: `0x${string}`,
  casters: `0x${string}`[]
): Promise<bigint> {
  const hatsClient = createHatsClient(10);

  // calculate the relevant hat IDs
  const currentNumTrees = await hatsClient.getTreesCount();
  const nextTopHatID = treeIdToTopHatId(currentNumTrees + 1);
  const nextTopHatIdHex = hatIdDecimalToHex(nextTopHatID);
  const autoAdminHatId = hatIdHexToDecimal(
    (nextTopHatIdHex.substring(0, 10) + "0001").padEnd(66, "0")
  );
  const casterHatId = hatIdHexToDecimal(
    (nextTopHatIdHex.substring(0, 10) + "00010001").padEnd(66, "0")
  );

  // prepare call data
  const mintTopHatCallData = hatsClient.mintTopHatCallData({
    target: topHatWearer,
    details: "temp",
  });
  const createAutoAdminHatCallData = hatsClient.createHatCallData({
    admin: nextTopHatID,
    details: "test",
    maxSupply: 1,
    eligibility: "0x0000000000000000000000000000000000004A75",
    toggle: "0x0000000000000000000000000000000000004A75",
    mutable: true,
  });
  const createCasterHatCallData = hatsClient.createHatCallData({
    admin: autoAdminHatId,
    details: "test",
    maxSupply: 100,
    eligibility: "0x0000000000000000000000000000000000004A75",
    toggle: "0x0000000000000000000000000000000000004A75",
    mutable: true,
  });
  const mintHatsCallData = hatsClient.batchMintHatsCallData({
    hatIds: Array(casters.length).fill(casterHatId),
    wearers: casters,
  });

  // create the tree
  const res = await hatsClient.multicall({
    account,
    calls: [
      mintTopHatCallData,
      createAutoAdminHatCallData,
      createCasterHatCallData,
      mintHatsCallData,
    ],
  });

  if (res.status === "success") {
    return casterHatId;
  } else {
    throw new Error("Tree creation failed");
  }
}
