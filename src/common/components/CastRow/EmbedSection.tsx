import { ErrorBoundary } from '@sentry/react';
import { Link as LinkIcon } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { isNftSaleUrl, isSwapUrl, isZapperTransactionUrl } from '@/common/helpers/onchain';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';
import EmbedCarousel from '../Embeds/EmbedCarousel';
import NftSaleEmbed from '../Embeds/NftSaleEmbed';
import OpenGraphImage from '../Embeds/OpenGraphImage';
import SwapEmbed from '../Embeds/SwapEmbed';
import { MultiEmbedStack } from '../Feed/MultiEmbedStack';
import { usePreviewEmbedContext } from '../Feed/PreviewEmbedContext';

interface ExternalUrlReplyProps {
  parentUrl: string | null;
  isExternalUrlReply: boolean;
  isSelected?: boolean;
  isEmbed: boolean;
  hideAuthor: boolean;
}

export const ExternalUrlReply: React.FC<ExternalUrlReplyProps> = ({
  parentUrl,
  isExternalUrlReply,
  isSelected,
  isEmbed,
  hideAuthor,
}) => {
  if (!isExternalUrlReply || !parentUrl) return null;

  // Route custom URI schemes to appropriate embed component
  const embedComponent = isNftSaleUrl(parentUrl) ? (
    <NftSaleEmbed url={parentUrl} isSelected={isSelected} />
  ) : isSwapUrl(parentUrl) ? (
    <SwapEmbed url={parentUrl} isSelected={isSelected} />
  ) : (
    <OpenGraphImage url={parentUrl} />
  );

  return (
    <div className="flex items-start gap-x-2 mb-2">
      {/* Left column: Link icon with connecting line - matches avatar column width */}
      {!isEmbed && !hideAuthor && (
        <div className="relative flex flex-col items-center shrink-0 w-10">
          {/* Link icon container - solid background with border */}
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted border border-muted-foreground/20">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          {/* Vertical connecting line from icon to avatar below */}
          <div className="flex-1 w-0.5 bg-foreground/10 min-h-[8px]" />
        </div>
      )}

      {/* Embed card - aligned with link icon */}
      <div className={cn('flex items-center flex-1 min-w-0', (isEmbed || hideAuthor) && 'ml-0')}>{embedComponent}</div>
    </div>
  );
};

interface EmbedListProps {
  cast: FarcasterCast;
  isSelected?: boolean;
  hideReactions: boolean;
}

export const EmbedList: React.FC<EmbedListProps> = ({ cast, isSelected, hideReactions }) => {
  const { inPreview } = usePreviewEmbedContext();

  // Preview pane uses MultiEmbedStack which owns its own filter pass — short
  // circuit before doing the legacy carousel filter so we don't pay for it.
  if (inPreview) {
    return <MultiEmbedStack cast={cast} hideReactions={hideReactions} />;
  }

  return <CarouselEmbedList cast={cast} isSelected={isSelected} hideReactions={hideReactions} />;
};

const CarouselEmbedList: React.FC<EmbedListProps> = ({ cast, isSelected, hideReactions }) => {
  const filteredEmbeds = useMemo(() => {
    if (!('embeds' in cast) || !cast.embeds.length) {
      return [];
    }

    // Filter out Zapper transaction URLs (we show custom embeds for those via renderExternalUrlReply)
    return cast.embeds.filter((embed) => {
      if ('url' in embed && embed.url) {
        return !isZapperTransactionUrl(embed.url);
      }
      return true;
    });
  }, [cast.embeds]);

  if (filteredEmbeds.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary>
      <EmbedCarousel embeds={filteredEmbeds} hideReactions={hideReactions} isSelected={isSelected} />
    </ErrorBoundary>
  );
};
