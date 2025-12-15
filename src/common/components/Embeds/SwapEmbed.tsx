import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  parseSwapUrl,
  getZapperSwapUrl,
  getAlchemyNetworkForSwapChain,
  getExplorerTxUrlByChain,
  getExplorerTokenUrl,
} from '@/common/helpers/onchain';
import { Skeleton } from '@/components/ui/skeleton';
import { openWindow } from '@/common/helpers/navigation';
import { ArrowTopRightOnSquareIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

type TokenMetadataResponse = {
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
};

/**
 * Fetch token metadata from our server-side cached API
 */
async function fetchTokenMetadata(chain: string, tokenAddress: string): Promise<TokenMetadataResponse | null> {
  const params = new URLSearchParams({
    chain,
    tokenAddress,
  });

  const response = await fetch(`/api/onchain/swap?${params.toString()}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.metadata;
}

/**
 * Hook to fetch token metadata with client-side caching
 */
function useTokenMetadata(chain: string, tokenAddress: string, enabled: boolean) {
  return useQuery({
    queryKey: ['token', 'metadata', chain, tokenAddress],
    queryFn: () => fetchTokenMetadata(chain, tokenAddress),
    enabled: enabled && !!tokenAddress,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days - server caches for 30 days
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    retry: 1,
  });
}

// Skeleton for loading state
const SwapSkeleton = () => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg">
    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  </div>
);

type SwapEmbedProps = {
  url: string;
};

export default function SwapEmbed({ url }: SwapEmbedProps) {
  const parsed = parseSwapUrl(url);

  // If parsing fails, show fallback link to Zapper
  if (!parsed) {
    const base64 = url.replace('swap://', '');
    return <FallbackCard zapperUrl={getZapperSwapUrl(base64)} />;
  }

  const { chain, tokenAddress, txHash, rawBase64 } = parsed;
  const zapperUrl = getZapperSwapUrl(rawBase64);
  const explorerUrl = getExplorerTxUrlByChain(chain, txHash);
  const tokenUrl = getExplorerTokenUrl(chain, tokenAddress);

  // Check if chain is supported by Alchemy
  const isChainSupported = !!getAlchemyNetworkForSwapChain(chain);

  const { data: metadata, isLoading, isError } = useTokenMetadata(chain, tokenAddress, isChainSupported);

  // Show fallback for unsupported chains
  if (!isChainSupported) {
    return <FallbackCard zapperUrl={zapperUrl} explorerUrl={explorerUrl} tokenUrl={tokenUrl} chainName={chain} />;
  }

  if (isLoading) {
    return <SwapSkeleton />;
  }

  if (isError || !metadata) {
    return <FallbackCard zapperUrl={zapperUrl} explorerUrl={explorerUrl} tokenUrl={tokenUrl} />;
  }

  const { symbol, logo } = metadata;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        openWindow(zapperUrl);
      }}
    >
      {/* Token Logo */}
      {logo ? (
        <img
          src={logo}
          alt={symbol}
          className="h-10 w-10 rounded-full object-cover flex-shrink-0 bg-muted"
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
          <ArrowsRightLeftIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {/* Swap Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">Swapped {symbol}</div>
        <div className="flex items-center gap-2 mt-1">
          {explorerUrl && <LinkButton href={explorerUrl} label="View tx" />}
          {tokenUrl && (
            <>
              {explorerUrl && <span className="text-muted-foreground">·</span>}
              <LinkButton href={tokenUrl} label="Token" />
            </>
          )}
          <span className="text-muted-foreground">·</span>
          <LinkButton href={zapperUrl} label="Zapper" />
        </div>
      </div>
    </div>
  );
}

// Fallback when metadata unavailable or chain not supported
function FallbackCard({
  zapperUrl,
  explorerUrl,
  tokenUrl,
  chainName,
}: {
  zapperUrl: string;
  explorerUrl?: string | null;
  tokenUrl?: string | null;
  chainName?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        openWindow(zapperUrl);
      }}
    >
      <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
        <ArrowsRightLeftIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">Token Swap{chainName ? ` · ${chainName}` : ''}</div>
        <div className="flex items-center gap-2 mt-1">
          {explorerUrl && <LinkButton href={explorerUrl} label="View tx" />}
          {tokenUrl && (
            <>
              {explorerUrl && <span className="text-muted-foreground">·</span>}
              <LinkButton href={tokenUrl} label="Token" />
            </>
          )}
          {(explorerUrl || tokenUrl) && <span className="text-muted-foreground">·</span>}
          <LinkButton href={zapperUrl} label="Zapper" />
        </div>
      </div>
    </div>
  );
}

// Small link button
function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <button
      className={cn(
        'text-xs text-muted-foreground hover:text-foreground hover:underline',
        'inline-flex items-center gap-0.5'
      )}
      onClick={(e) => {
        e.stopPropagation();
        openWindow(href);
      }}
    >
      {label}
      <ArrowTopRightOnSquareIcon className="h-3 w-3" />
    </button>
  );
}
