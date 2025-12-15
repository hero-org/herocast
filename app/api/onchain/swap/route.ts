import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

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

export type TokenMetadataResponse = {
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
};

/**
 * Fetch token metadata from Alchemy
 */
async function fetchTokenMetadataUncached(chain: string, tokenAddress: string): Promise<TokenMetadataResponse | null> {
  const startTime = Date.now();
  console.log(`[onchain/swap] Fetching token metadata for chain=${chain}, token=${tokenAddress}`);

  const network = CHAIN_TO_ALCHEMY[chain.toLowerCase()];
  if (!network) {
    console.log(`[onchain/swap] Chain ${chain} not supported by Alchemy`);
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
      headers: { 'Content-Type': 'application/json' },
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
      console.log(`[onchain/swap] No token metadata found for ${tokenAddress}`);
      return null;
    }

    console.log(`[onchain/swap] Success for ${tokenAddress} in ${Date.now() - startTime}ms`);

    return {
      symbol: result.symbol,
      name: result.name || result.symbol,
      logo: result.logo || undefined,
      decimals: result.decimals || 18,
    };
  } catch (error) {
    console.error(`[onchain/swap] Error fetching token metadata:`, error);
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    const tokenAddress = searchParams.get('tokenAddress');

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

    const metadata = await getCachedTokenMetadata(chain.toLowerCase(), tokenAddress.toLowerCase());

    if (!metadata) {
      return NextResponse.json({ error: 'Could not fetch token metadata' }, { status: 404 });
    }

    return NextResponse.json({ metadata });
  } catch (error) {
    console.error('[onchain/swap] Error in route handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
