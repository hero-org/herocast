import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Chain ID to Alchemy network mapping
const ALCHEMY_NETWORKS: Record<number, string> = {
  1: 'eth-mainnet',
  10: 'opt-mainnet',
  137: 'polygon-mainnet',
  8453: 'base-mainnet',
  42161: 'arb-mainnet',
};

// Chain ID to OpenSea network mapping
const OPENSEA_NETWORKS: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
};

// ERC721 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export type NftMetadataResponse = {
  tokenId: string;
  name?: string;
  collectionName?: string;
  imageUrl?: string;
  openSeaUrl: string;
};

/**
 * Fetch the actual token ID from a transaction's Transfer event logs
 */
async function fetchTokenIdFromTx(chainId: number, contractAddress: string, txHash: string): Promise<string | null> {
  if (!ALCHEMY_API_KEY) {
    console.warn('[nft/metadata] No Alchemy API key configured');
    return null;
  }

  const network = ALCHEMY_NETWORKS[chainId] || 'eth-mainnet';
  const url = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

  // Debug: Log API key status (not the key itself)
  console.log(`[nft/metadata] Using Alchemy network: ${network}, API key length: ${ALCHEMY_API_KEY.length}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://app.herocast.xyz',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [txHash],
      id: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });

  // Handle non-OK responses (Alchemy returns plain text for errors like 403)
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[nft/metadata] Alchemy RPC error ${response.status}:`, errorText);
    throw new Error(`RPC error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Handle JSON-RPC errors
  if (data.error) {
    console.error(`[nft/metadata] Alchemy JSON-RPC error:`, data.error);
    throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const receipt = data.result;

  if (!receipt?.logs) {
    console.log(`[nft/metadata] No receipt or logs found for tx ${txHash}`);
    return null;
  }

  console.log(`[nft/metadata] Found ${receipt.logs.length} logs in tx`);

  // Find Transfer event for the specific contract
  const transferLog = receipt.logs.find(
    (log: { address: string; topics: string[] }) =>
      log.address.toLowerCase() === contractAddress.toLowerCase() &&
      log.topics[0] === TRANSFER_EVENT_SIGNATURE &&
      log.topics.length >= 4
  );

  if (!transferLog) {
    // Debug: show what contracts emitted Transfer events
    const transferLogs = receipt.logs.filter(
      (log: { address: string; topics: string[] }) => log.topics[0] === TRANSFER_EVENT_SIGNATURE
    );
    console.log(
      `[nft/metadata] No Transfer event for contract ${contractAddress}. Transfer events found from:`,
      transferLogs.map((l: { address: string }) => l.address)
    );
    return null;
  }

  // Token ID is in topics[3] for ERC721 Transfer(from, to, tokenId)
  const tokenIdHex = transferLog.topics[3];
  return BigInt(tokenIdHex).toString();
}

/**
 * Fetch NFT metadata from Alchemy
 */
async function fetchNftMetadataFromAlchemy(
  chainId: number,
  contractAddress: string,
  tokenId: string
): Promise<{ name?: string; collectionName?: string; imageUrl?: string } | null> {
  if (!ALCHEMY_API_KEY) {
    return null;
  }

  const network = ALCHEMY_NETWORKS[chainId] || 'eth-mainnet';
  const url = `https://${network}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`;

  const response = await fetch(url, {
    headers: {
      Origin: 'https://app.herocast.xyz',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[nft/metadata] Alchemy NFT API error ${response.status}:`, errorText);
    throw new Error(`Alchemy NFT API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.error) {
    console.error(`[nft/metadata] Alchemy NFT API JSON error:`, data.error);
    throw new Error(data.error.message);
  }

  return {
    name: data.name,
    collectionName: data.collection?.name,
    imageUrl: data.image?.thumbnailUrl || data.image?.cachedUrl || data.image?.originalUrl,
  };
}

/**
 * Main uncached function that fetches all NFT sale data
 */
async function fetchNftSaleMetadataUncached(
  chainId: number,
  contractAddress: string,
  txHash: string
): Promise<NftMetadataResponse | null> {
  const startTime = Date.now();
  console.log(`[nft/metadata] Fetching NFT metadata for chain=${chainId}, contract=${contractAddress}, tx=${txHash}`);

  try {
    // Step 1: Get the actual token ID from the transaction
    console.log(`[nft/metadata] Step 1: Fetching token ID from tx...`);
    const tokenId = await fetchTokenIdFromTx(chainId, contractAddress, txHash);

    if (!tokenId) {
      console.log(
        `[nft/metadata] FAILED: Could not extract token ID from tx ${txHash} - no matching Transfer event found`
      );
      return null;
    }

    console.log(`[nft/metadata] Step 1 SUCCESS: Found token ID: ${tokenId} in ${Date.now() - startTime}ms`);

    // Step 2: Get NFT metadata from Alchemy
    console.log(`[nft/metadata] Step 2: Fetching NFT metadata from Alchemy...`);
    const metadata = await fetchNftMetadataFromAlchemy(chainId, contractAddress, tokenId);
    console.log(`[nft/metadata] Step 2 result:`, metadata ? 'success' : 'null');

    // Step 3: Generate OpenSea URL
    const network = OPENSEA_NETWORKS[chainId] || 'ethereum';
    const openSeaUrl = `https://opensea.io/assets/${network}/${contractAddress}/${tokenId}`;

    const result: NftMetadataResponse = {
      tokenId,
      name: metadata?.name,
      collectionName: metadata?.collectionName,
      imageUrl: metadata?.imageUrl,
      openSeaUrl,
    };

    console.log(`[nft/metadata] Success for tx ${txHash} in ${Date.now() - startTime}ms`);
    return result;
  } catch (error) {
    console.error(`[nft/metadata] Error fetching NFT metadata:`, error);
    return null;
  }
}

/**
 * Create cached version with unstable_cache
 * NFT metadata is immutable, so we use a very long cache (30 days)
 */
const getCachedNftMetadata = (chainId: number, contractAddress: string, txHash: string) =>
  unstable_cache(
    () => fetchNftSaleMetadataUncached(chainId, contractAddress, txHash),
    [`nft-metadata-${chainId}-${contractAddress}-${txHash}`],
    {
      revalidate: 2592000, // 30 days (NFT metadata is immutable)
      tags: ['nft-metadata'],
    }
  )();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIdStr = searchParams.get('chainId');
    const contractAddress = searchParams.get('contractAddress');
    const txHash = searchParams.get('txHash');

    // Validate required parameters
    if (!chainIdStr || !contractAddress || !txHash) {
      return NextResponse.json(
        { error: 'Missing required parameters: chainId, contractAddress, txHash' },
        { status: 400 }
      );
    }

    const chainId = parseInt(chainIdStr, 10);
    if (isNaN(chainId)) {
      return NextResponse.json({ error: 'Invalid chainId' }, { status: 400 });
    }

    // Validate contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    // Validate tx hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    if (!ALCHEMY_API_KEY) {
      return NextResponse.json({ error: 'Alchemy API key not configured' }, { status: 500 });
    }

    const metadata = await getCachedNftMetadata(chainId, contractAddress.toLowerCase(), txHash.toLowerCase());

    if (!metadata) {
      return NextResponse.json({ error: 'Could not fetch NFT metadata' }, { status: 404 });
    }

    return NextResponse.json({ metadata });
  } catch (error) {
    console.error('[nft/metadata] Error in route handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
