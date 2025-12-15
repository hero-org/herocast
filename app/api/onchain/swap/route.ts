import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Chain name to Alchemy network mapping
const CHAIN_TO_ALCHEMY: Record<string, string> = {
  base: 'base-mainnet',
  ethereum: 'eth-mainnet',
  optimism: 'opt-mainnet',
  polygon: 'polygon-mainnet',
  arbitrum: 'arb-mainnet',
  // Note: 'hyperevm' is NOT supported - will return 404
};

// ERC-4337 EntryPoint contract addresses
const ENTRYPOINT_ADDRESSES = [
  '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789', // v0.6.0
  '0x0576a174d229e3cfa37253523e645a78a0c91b57', // v0.7.0
];

// keccak256("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)")
const USER_OPERATION_EVENT_SIGNATURE = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';

export type SwapMetadataResponse = {
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  sender?: string; // Address that initiated the swap
};

/**
 * Fetch transaction sender from Alchemy
 * Handles both regular EOA transactions and ERC-4337 smart account transactions
 */
async function fetchTxSender(chain: string, txHash: string): Promise<string | null> {
  const network = CHAIN_TO_ALCHEMY[chain.toLowerCase()];
  if (!network || !ALCHEMY_API_KEY) return null;

  try {
    const url = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    // First, fetch the transaction to get 'from' and 'to' addresses
    const txResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.NEXT_PUBLIC_APP_URL || 'https://app.herocast.xyz',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!txResponse.ok) return null;

    const txData = await txResponse.json();
    const from = txData.result?.from;
    const to = txData.result?.to;

    if (!from || !to) return null;

    // Check if the transaction is sent to an ERC-4337 EntryPoint contract
    const isEntryPoint = ENTRYPOINT_ADDRESSES.includes(to.toLowerCase());

    if (!isEntryPoint) {
      // Regular transaction - return the 'from' address
      return from;
    }

    // ERC-4337 transaction - fetch receipt to extract actual sender from UserOperationEvent
    const receiptResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.NEXT_PUBLIC_APP_URL || 'https://app.herocast.xyz',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 2,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!receiptResponse.ok) return from; // Fallback to bundler address

    const receiptData = await receiptResponse.json();
    const logs = receiptData.result?.logs;

    if (!logs || !Array.isArray(logs)) return from;

    // Find the UserOperationEvent log
    const userOpEvent = logs.find(
      (log: any) => log.topics?.[0]?.toLowerCase() === USER_OPERATION_EVENT_SIGNATURE.toLowerCase()
    );

    if (!userOpEvent || !userOpEvent.topics?.[2]) {
      // UserOperationEvent not found, fallback to bundler address
      return from;
    }

    // Extract sender from topics[2] (32-byte padded address, take last 20 bytes)
    const sender = '0x' + userOpEvent.topics[2].slice(26);
    return sender;
  } catch {
    return null;
  }
}

/**
 * Fetch token metadata from Alchemy
 */
async function fetchTokenMetadataUncached(chain: string, tokenAddress: string): Promise<SwapMetadataResponse | null> {
  const network = CHAIN_TO_ALCHEMY[chain.toLowerCase()];
  if (!network) {
    return null;
  }

  if (!ALCHEMY_API_KEY) {
    console.warn('[onchain/swap] No Alchemy API key configured');
    return null;
  }

  try {
    const url = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.NEXT_PUBLIC_APP_URL || 'https://app.herocast.xyz',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [tokenAddress],
        id: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const result = data.result;
    if (!result || !result.symbol) {
      return null;
    }

    return {
      symbol: result.symbol,
      name: result.name || result.symbol,
      logo: result.logo || undefined,
      decimals: result.decimals || 18,
    };
  } catch (error) {
    console.error(`[onchain/swap] Error fetching token metadata:`, error);
    Sentry.captureException(error);
    return null;
  }
}

/**
 * Create cached version with unstable_cache
 * Token metadata is immutable, so we use a very long cache (30 days)
 */
const getCachedTokenMetadata = (chain: string, tokenAddress: string) =>
  unstable_cache(() => fetchTokenMetadataUncached(chain, tokenAddress), [`token-metadata-${chain}-${tokenAddress}`], {
    revalidate: 2592000, // 30 days (token metadata is immutable)
    tags: ['token-metadata'],
  })();

/**
 * Cached version for tx sender (also immutable)
 */
const getCachedTxSender = (chain: string, txHash: string) =>
  unstable_cache(() => fetchTxSender(chain, txHash), [`tx-sender-${chain}-${txHash}`], {
    revalidate: 2592000, // 30 days (tx sender is immutable)
    tags: ['tx-sender'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    const tokenAddress = searchParams.get('tokenAddress');
    const txHash = searchParams.get('txHash'); // Optional

    // Validate required parameters
    if (!chain || !tokenAddress) {
      return NextResponse.json({ error: 'Missing required parameters: chain, tokenAddress' }, { status: 400 });
    }

    // Check if chain is supported
    if (!CHAIN_TO_ALCHEMY[chain.toLowerCase()]) {
      return NextResponse.json({ error: `Chain ${chain} not supported` }, { status: 404 });
    }

    // Validate token address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json({ error: 'Invalid token address format' }, { status: 400 });
    }

    if (!ALCHEMY_API_KEY) {
      return NextResponse.json({ error: 'Alchemy API key not configured' }, { status: 500 });
    }

    // Fetch token metadata and sender in parallel if txHash is provided
    const [metadata, sender] = await Promise.all([
      getCachedTokenMetadata(chain.toLowerCase(), tokenAddress.toLowerCase()),
      txHash ? getCachedTxSender(chain.toLowerCase(), txHash.toLowerCase()) : Promise.resolve(null),
    ]);

    if (!metadata) {
      return NextResponse.json({ error: 'Could not fetch token metadata' }, { status: 404 });
    }

    return NextResponse.json({
      metadata: {
        ...metadata,
        sender: sender || undefined,
      },
    });
  } catch (error) {
    console.error('[onchain/swap] Error in route handler:', error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const maxDuration = 20;
