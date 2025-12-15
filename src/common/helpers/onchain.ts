/**
 * Onchain URI scheme parsing utilities.
 * Supports custom URI schemes from clients like Zapper.
 */

// Chain ID to network name mapping for URL generation
const CHAIN_NETWORKS: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
};

// Chain ID to Alchemy network for RPC
const ALCHEMY_NETWORKS: Record<number, string> = {
  1: 'eth-mainnet',
  10: 'opt-mainnet',
  137: 'polygon-mainnet',
  8453: 'base-mainnet',
  42161: 'arb-mainnet',
};

// ERC721 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export type NftSaleData = {
  chainId: number;
  contractAddress: string;
  timestamp: number;
  logIndex: number;
  txHash: string;
  rawBase64: string;
};

/**
 * Check if a URL is an nft-sale:// URI scheme
 */
export function isNftSaleUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('nft-sale://');
}

/**
 * Parse an nft-sale:// URL into structured data
 *
 * Format: nft-sale://BASE64_DATA
 * Decoded: chainId|contractAddress|timestamp|unknown|logIndex|txHash
 *
 * Note: logIndex is the position of the Transfer event in the transaction,
 * NOT the token ID. Use fetchTokenIdFromTx() to get the actual token ID.
 */
export function parseNftSaleUrl(url: string): NftSaleData | null {
  if (!isNftSaleUrl(url)) return null;

  try {
    const base64 = url.replace('nft-sale://', '');
    const decoded = atob(base64);
    const parts = decoded.split('|');

    if (parts.length < 6) {
      console.warn('[onchain] Invalid nft-sale URL format:', url);
      return null;
    }

    const [chainIdStr, contractAddress, timestampStr, , logIndexStr, txHash] = parts;

    return {
      chainId: parseInt(chainIdStr, 10),
      contractAddress,
      timestamp: parseInt(timestampStr, 10),
      logIndex: parseInt(logIndexStr, 10),
      txHash,
      rawBase64: base64,
    };
  } catch (error) {
    console.error('[onchain] Failed to parse nft-sale URL:', error);
    return null;
  }
}

/**
 * Fetch the actual token ID from a transaction's Transfer event logs
 */
export async function fetchTokenIdFromTx(
  chainId: number,
  contractAddress: string,
  txHash: string
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!apiKey) {
    console.warn('[onchain] No Alchemy API key configured');
    return null;
  }

  const network = ALCHEMY_NETWORKS[chainId] || 'eth-mainnet';
  const url = `https://${network}.g.alchemy.com/v2/${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status}`);
    }

    const data = await response.json();
    const receipt = data.result;

    if (!receipt?.logs) {
      return null;
    }

    // Find Transfer event for the specific contract
    const transferLog = receipt.logs.find(
      (log: { address: string; topics: string[] }) =>
        log.address.toLowerCase() === contractAddress.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_SIGNATURE &&
        log.topics.length >= 4
    );

    if (!transferLog) {
      return null;
    }

    // Token ID is in topics[3] for ERC721 Transfer(from, to, tokenId)
    const tokenIdHex = transferLog.topics[3];
    return BigInt(tokenIdHex).toString();
  } catch (error) {
    console.error('[onchain] Failed to fetch token ID from tx:', error);
    return null;
  }
}

/**
 * Generate Zapper NFT sale URL
 */
export function getZapperNftSaleUrl(base64: string): string {
  return `https://zapper.xyz/nft-sale/${base64}`;
}

/**
 * Generate OpenSea URL for an NFT
 */
export function getOpenSeaUrl(chainId: number, contractAddress: string, tokenId: string): string {
  const network = CHAIN_NETWORKS[chainId] || 'ethereum';
  return `https://opensea.io/assets/${network}/${contractAddress}/${tokenId}`;
}

/**
 * Generate Etherscan/block explorer URL for a transaction
 */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${txHash}`;
    case 10:
      return `https://optimistic.etherscan.io/tx/${txHash}`;
    case 137:
      return `https://polygonscan.com/tx/${txHash}`;
    case 8453:
      return `https://basescan.org/tx/${txHash}`;
    case 42161:
      return `https://arbiscan.io/tx/${txHash}`;
    default:
      return `https://etherscan.io/tx/${txHash}`;
  }
}

// =============================================================================
// Swap URI Scheme (swap://)
// =============================================================================

// Chain name (from URL) to Alchemy network mapping
const SWAP_CHAIN_TO_ALCHEMY: Record<string, string> = {
  base: 'base-mainnet',
  ethereum: 'eth-mainnet',
  optimism: 'opt-mainnet',
  polygon: 'polygon-mainnet',
  arbitrum: 'arb-mainnet',
  // Note: 'hyperevm' is NOT supported by Alchemy - will return null
};

export type SwapData = {
  chain: string; // e.g., "hyperevm", "base"
  txHash: string;
  blockNumber: number;
  timestamp: number;
  tokenAddress: string;
  rawBase64: string;
};

/**
 * Check if a URL is a swap:// URI scheme
 */
export function isSwapUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('swap://');
}

/**
 * Parse a swap:// URL into structured data
 *
 * Format: swap://BASE64_DATA
 * Decoded: ChannelFeedSwap-{chain}|txHash|blockNumber|timestamp|tokenAddress|boolean
 *
 * Example:
 * ChannelFeedSwap-hyperevm|0x34bdd163...|337987|1765250439000|0x94e8396e...|true
 */
export function parseSwapUrl(url: string): SwapData | null {
  if (!isSwapUrl(url)) return null;

  try {
    const base64 = url.replace('swap://', '');
    const decoded = atob(base64);
    const parts = decoded.split('|');

    if (parts.length < 5) {
      console.warn('[onchain] Invalid swap URL format:', url);
      return null;
    }

    const [typeChain, txHash, blockNumberStr, timestampStr, tokenAddress] = parts;

    // Extract chain from "ChannelFeedSwap-{chain}" format
    const chain = typeChain.replace('ChannelFeedSwap-', '');

    return {
      chain,
      txHash,
      blockNumber: parseInt(blockNumberStr, 10),
      timestamp: parseInt(timestampStr, 10),
      tokenAddress,
      rawBase64: base64,
    };
  } catch (error) {
    console.error('[onchain] Failed to parse swap URL:', error);
    return null;
  }
}

/**
 * Generate Zapper swap URL
 */
export function getZapperSwapUrl(base64: string): string {
  return `https://zapper.xyz/swap/${base64}`;
}

/**
 * Get Alchemy network for a swap chain name
 * Returns null if chain is not supported by Alchemy
 */
export function getAlchemyNetworkForSwapChain(chain: string): string | null {
  return SWAP_CHAIN_TO_ALCHEMY[chain.toLowerCase()] || null;
}

// Chain name to block explorer base URL mapping
const CHAIN_EXPLORERS: Record<string, string> = {
  base: 'https://basescan.org',
  ethereum: 'https://etherscan.io',
  optimism: 'https://optimistic.etherscan.io',
  polygon: 'https://polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  hyperevm: 'https://explorer.hyperliquid.xyz',
};

/**
 * Generate block explorer URL for a transaction by chain name
 */
export function getExplorerTxUrlByChain(chain: string, txHash: string): string | null {
  const explorer = CHAIN_EXPLORERS[chain.toLowerCase()];
  if (!explorer) return null;
  return `${explorer}/tx/${txHash}`;
}

/**
 * Generate block explorer URL for a token by chain name
 */
export function getExplorerTokenUrl(chain: string, tokenAddress: string): string | null {
  const explorer = CHAIN_EXPLORERS[chain.toLowerCase()];
  if (!explorer) return null;
  return `${explorer}/token/${tokenAddress}`;
}

/**
 * Check if URL is a Zapper OG URL for swap or nft-sale
 * These are filtered when we already show custom SwapEmbed/NftSaleEmbed
 */
export function isZapperTransactionUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('https://zapper.xyz/swap/') || url.startsWith('https://zapper.xyz/nft-sale/');
}
