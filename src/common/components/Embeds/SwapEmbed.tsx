import { ArrowsRightLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { openWindow } from '@/common/helpers/navigation';
import {
  getAlchemyNetworkForSwapChain,
  getExplorerTokenUrl,
  getExplorerTxUrlByChain,
  getZapperSwapUrl,
  parseSwapUrl,
} from '@/common/helpers/onchain';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type SwapMetadataResponse = {
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  sender?: string;
};

type FarcasterUser = {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
};

/**
 * Abbreviate an address to 0x1234...5678 format
 */
function abbreviateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Fetch Farcaster user by Ethereum address
 */
async function fetchUserByAddress(address: string): Promise<FarcasterUser | null> {
  const response = await fetch(`/api/users/by-address?address=${address}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.user;
}

/**
 * Hook to fetch Farcaster user by address
 */
function useFarcasterUser(address: string | undefined) {
  return useQuery({
    queryKey: ['user', 'by-address', address],
    queryFn: () => fetchUserByAddress(address!),
    enabled: !!address,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    retry: false, // Don't retry - if no user found, that's final
  });
}

/**
 * Fetch swap metadata from our server-side cached API
 */
async function fetchSwapMetadata(
  chain: string,
  tokenAddress: string,
  txHash: string
): Promise<SwapMetadataResponse | null> {
  const params = new URLSearchParams({
    chain,
    tokenAddress,
    txHash,
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
 * Hook to fetch swap metadata with client-side caching
 */
function useSwapMetadata(chain: string, tokenAddress: string, txHash: string, enabled: boolean) {
  return useQuery({
    queryKey: ['swap', 'metadata', chain, tokenAddress, txHash],
    queryFn: () => fetchSwapMetadata(chain, tokenAddress, txHash),
    enabled: enabled && !!tokenAddress && !!txHash,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days - server caches for 30 days
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    retry: 1,
  });
}

// Skeleton for loading state
const SwapSkeleton = () => (
  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg">
    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-4 w-32 rounded" />
      <Skeleton className="h-4 w-40 rounded" />
      <Skeleton className="h-3 w-48 rounded" />
    </div>
  </div>
);

type SwapEmbedProps = {
  url: string;
  isSelected?: boolean;
};

export default function SwapEmbed({ url, isSelected }: SwapEmbedProps) {
  const parsed = parseSwapUrl(url);

  // If parsing fails, show fallback link to Zapper
  if (!parsed) {
    const base64 = url.replace('swap://', '');
    return <FallbackCard zapperUrl={getZapperSwapUrl(base64)} isSelected={isSelected} />;
  }

  const { chain, tokenAddress, txHash, rawBase64 } = parsed;
  const zapperUrl = getZapperSwapUrl(rawBase64);
  const explorerUrl = getExplorerTxUrlByChain(chain, txHash);
  const tokenUrl = getExplorerTokenUrl(chain, tokenAddress);

  // Check if chain is supported by Alchemy
  const isChainSupported = !!getAlchemyNetworkForSwapChain(chain);

  const { data: metadata, isLoading, isError } = useSwapMetadata(chain, tokenAddress, txHash, isChainSupported);

  // Fetch Farcaster user for the sender address
  const { data: farcasterUser } = useFarcasterUser(metadata?.sender);

  // Show fallback for unsupported chains
  if (!isChainSupported) {
    return (
      <FallbackCard
        zapperUrl={zapperUrl}
        explorerUrl={explorerUrl}
        tokenUrl={tokenUrl}
        chainName={chain}
        isSelected={isSelected}
      />
    );
  }

  if (isLoading) {
    return <SwapSkeleton />;
  }

  if (isError || !metadata) {
    return <FallbackCard zapperUrl={zapperUrl} explorerUrl={explorerUrl} tokenUrl={tokenUrl} isSelected={isSelected} />;
  }

  const { symbol, logo, sender } = metadata;

  // Format sender display: prefer username, fallback to abbreviated address
  const senderDisplay = farcasterUser ? `@${farcasterUser.username}` : sender ? abbreviateAddress(sender) : 'Unknown';

  // Get avatar: prefer Farcaster PFP, fallback to swap icon
  const avatarSrc = farcasterUser?.pfp_url;
  const avatarFallback = senderDisplay.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded-lg border max-w-lg cursor-pointer transition-colors',
        isSelected ? 'bg-muted/70 border-foreground/20' : 'bg-muted/50 border-muted hover:bg-muted/70'
      )}
      onClick={(e) => {
        e.stopPropagation();
        openWindow(zapperUrl);
      }}
    >
      {/* User Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback>
          {avatarSrc ? avatarFallback : <ArrowsRightLeftIcon className="h-5 w-5 text-muted-foreground" />}
        </AvatarFallback>
      </Avatar>

      {/* Swap Content */}
      <div className="flex-1 min-w-0">
        {/* Author line */}
        <div className="text-sm font-semibold text-foreground truncate">{senderDisplay}</div>

        {/* Swap action line */}
        <div className="flex items-center gap-1.5 mt-0.5 text-sm text-foreground/80">
          <ArrowsRightLeftIcon className="h-4 w-4 flex-shrink-0" />
          <span>swapped {symbol}</span>
          {logo && (
            <img
              src={logo}
              alt={symbol}
              className="h-4 w-4 rounded-full object-cover inline-block ml-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>

        {/* Links line */}
        <div className="flex items-center gap-2 mt-1.5">
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
  isSelected,
}: {
  zapperUrl: string;
  explorerUrl?: string | null;
  tokenUrl?: string | null;
  chainName?: string;
  isSelected?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded-lg border max-w-lg cursor-pointer transition-colors',
        isSelected ? 'bg-muted/70 border-foreground/20' : 'bg-muted/50 border-muted hover:bg-muted/70'
      )}
      onClick={(e) => {
        e.stopPropagation();
        openWindow(zapperUrl);
      }}
    >
      {/* Fallback avatar with swap icon */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarFallback>
          <ArrowsRightLeftIcon className="h-5 w-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Author line - generic for fallback */}
        <div className="text-sm font-semibold text-foreground truncate">Unknown</div>

        {/* Swap action line */}
        <div className="flex items-center gap-1.5 mt-0.5 text-sm text-foreground/80">
          <ArrowsRightLeftIcon className="h-4 w-4 flex-shrink-0" />
          <span>Token Swap{chainName ? ` · ${chainName}` : ''}</span>
        </div>

        {/* Links line */}
        <div className="flex items-center gap-2 mt-1.5">
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
