import { HatsClient, treeIdToTopHatId, hatIdDecimalToHex, hatIdHexToDecimal } from '@hatsprotocol/sdk-v1-core';
import { publicClient } from './rainbowkit';
import { optimism } from 'viem/chains';
import { PublicClient, WalletClient } from 'viem';

export async function createInitialTree(
  account: `0x${string}`,
  casterAdmin: `0x${string}`,
  casters: `0x${string}`[],
  walletClient: WalletClient
): Promise<{ casterHat: bigint; adminHat: bigint }> {
  const hatsClient = new HatsClient({
    chainId: optimism.id,
    publicClient: publicClient as PublicClient,
    walletClient: walletClient,
  });

  const currentNumTrees = await hatsClient.getTreesCount();
  const nextTopHatID = treeIdToTopHatId(currentNumTrees + 1);
  const nextTopHatIdHex = hatIdDecimalToHex(nextTopHatID);
  const autoAdminHatId = hatIdHexToDecimal((nextTopHatIdHex.substring(0, 10) + '0001').padEnd(66, '0'));
  const casterAdminHatId = hatIdHexToDecimal((nextTopHatIdHex.substring(0, 10) + '00010001').padEnd(66, '0'));
  const casterHatId = hatIdHexToDecimal((nextTopHatIdHex.substring(0, 10) + '000100010001').padEnd(66, '0'));

  // prepare call data for hats creation
  const mintTopHatCallData = hatsClient.mintTopHatCallData({
    target: account,
    details: 'ipfs://bafkreigzbdvqbv23xj7jjyqcxkgsuvbs4q4apshris6x5awflhdkvizjdy',
    imageURI: 'ipfs://bafkreieuvcanr3amnqgxletyb5lf5zfc7siu4ovu4odpm2axipnmnf5hce',
  });
  const createAutoAdminHatCallData = hatsClient.createHatCallData({
    admin: nextTopHatID,
    details: 'ipfs://bafkreihe2rxghtnomgaxs5fv2suxog6bdxkgxxifik7z6gtu65mi3oycue',
    maxSupply: 1,
    eligibility: '0x0000000000000000000000000000000000004A75',
    toggle: '0x0000000000000000000000000000000000004A75',
    mutable: true,
  });
  const createCasterAdminHatCallData = hatsClient.createHatCallData({
    admin: autoAdminHatId,
    details: 'ipfs://bafkreiax5tjyhestv5op33cje6yrhsaylnblu7t6tl7w25qmhl4cojpap4',
    maxSupply: 5,
    eligibility: '0x0000000000000000000000000000000000004A75',
    toggle: '0x0000000000000000000000000000000000004A75',
    mutable: true,
  });
  const createCasterHatCallData = hatsClient.createHatCallData({
    admin: casterAdminHatId,
    details: 'ipfs://bafkreig325iyeqwpzigo4anb2qjzux5lu4gww4ewna23pbtluys52pmtcy',
    maxSupply: 100,
    eligibility: '0x0000000000000000000000000000000000004A75',
    toggle: '0x0000000000000000000000000000000000004A75',
    mutable: true,
  });

  // prepare call data for hats minting
  const mintHatsCallData = hatsClient.batchMintHatsCallData({
    hatIds: [...Array(casters.length).fill(casterHatId), casterAdminHatId],
    wearers: [...casters, casterAdmin],
  });

  // create the tree
  const res = await hatsClient.multicall({
    account,
    calls: [
      mintTopHatCallData,
      createAutoAdminHatCallData,
      createCasterAdminHatCallData,
      createCasterHatCallData,
      mintHatsCallData,
    ],
  });

  if (res.status === 'success') {
    return { casterHat: casterHatId, adminHat: casterAdminHatId };
  } else {
    throw new Error('Tree creation failed');
  }
}
