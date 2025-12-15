import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseNftSaleUrl, getZapperNftSaleUrl } from '@/common/helpers/onchain';
import { Skeleton } from '@/components/ui/skeleton';
import { openWindow } from '@/common/helpers/navigation';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

type NftMetadataResponse = {
  tokenId: string;
  name?: string;
  collectionName?: string;
  imageUrl?: string;
  openSeaUrl: string;
};

/**
 * Fetch NFT metadata from our server-side cached API
 */
async function fetchNftMetadata(
  chainId: number,
  contractAddress: string,
  txHash: string
): Promise<NftMetadataResponse | null> {
  const params = new URLSearchParams({
    chainId: chainId.toString(),
    contractAddress,
    txHash,
  });

  const response = await fetch(`/api/onchain/nft-sale?${params.toString()}`);

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
 * Hook to fetch NFT metadata with client-side caching
 */
function useNftMetadata(chainId: number, contractAddress: string, txHash: string) {
  return useQuery({
    queryKey: ['nft', 'metadata', chainId, contractAddress, txHash],
    queryFn: () => fetchNftMetadata(chainId, contractAddress, txHash),
    enabled: !!contractAddress && !!txHash,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days - server caches for 30 days
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    retry: 1,
  });
}

// Skeleton for loading state
const NftSaleSkeleton = () => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg">
    <Skeleton className="h-12 w-12 rounded-md flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  </div>
);

type NftSaleEmbedProps = {
  url: string;
};

export default function NftSaleEmbed({ url }: NftSaleEmbedProps) {
  const parsed = parseNftSaleUrl(url);

  // If parsing fails, show fallback link to Zapper
  if (!parsed) {
    const base64 = url.replace('nft-sale://', '');
    return <FallbackCard zapperUrl={getZapperNftSaleUrl(base64)} />;
  }

  const { chainId, contractAddress, txHash, rawBase64 } = parsed;
  const zapperUrl = getZapperNftSaleUrl(rawBase64);

  const { data: metadata, isLoading, isError } = useNftMetadata(chainId, contractAddress, txHash);

  if (isLoading) {
    return <NftSaleSkeleton />;
  }

  if (isError || !metadata) {
    return <FallbackCard zapperUrl={zapperUrl} />;
  }

  const { tokenId, name, collectionName, imageUrl, openSeaUrl } = metadata;
  const displayName = name || `#${tokenId}`;
  const displayCollection = collectionName || 'NFT';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        openWindow(zapperUrl);
      }}
    >
      {/* NFT Image */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={displayName}
          className="h-12 w-12 rounded-md object-cover flex-shrink-0 bg-muted"
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="h-12 w-12 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
          <span className="text-lg">🖼️</span>
        </div>
      )}

      {/* NFT Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{displayCollection}</div>
        <div className="text-xs text-muted-foreground truncate">{displayName}</div>
        <div className="flex items-center gap-2 mt-1">
          <LinkButton href={zapperUrl} label="Zapper" />
          <LinkButton href={openSeaUrl} label="OpenSea" />
        </div>
      </div>
    </div>
  );
}

// Fallback when metadata unavailable
function FallbackCard({ zapperUrl }: { zapperUrl: string }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        openWindow(zapperUrl);
      }}
    >
      <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
        <span className="text-lg">🖼️</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">NFT Sale</div>
        <div className="text-xs text-muted-foreground">View on Zapper</div>
      </div>
      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
