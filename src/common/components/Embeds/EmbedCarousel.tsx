import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { renderEmbedForUrl } from './index';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { openWindow } from '@/common/helpers/navigation';
import { isZapperTransactionUrl } from '@/common/helpers/onchain';

type EmbedCarouselProps = {
  embeds: Array<{
    url?: string;
    cast_id?: {
      fid: number;
      hash: string;
    };
    castId?: {
      fid: number;
      hash: string;
    };
  }>;
  hideReactions?: boolean;
  isSelected?: boolean;
};

const EmbedCarousel = ({ embeds, hideReactions, isSelected }: EmbedCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number | 'auto'>('auto');
  const embedRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter out Zapper transaction URLs (we show custom embeds for those)
  const filteredEmbeds = useMemo(() => {
    return embeds.filter((embed) => !isZapperTransactionUrl(embed.url));
  }, [embeds]);

  // Reset state when embeds change
  useEffect(() => {
    setCurrentIndex(0);
    setContainerHeight('auto');
    embedRefs.current = [];
  }, [filteredEmbeds]);

  // Track height of current embed with ResizeObserver
  useEffect(() => {
    const currentRef = embedRefs.current[currentIndex];
    if (!currentRef) return;

    const updateHeight = () => {
      const height = currentRef.offsetHeight;
      if (height > 0) {
        setContainerHeight(height);
      }
    };

    // Initial measurement with small delay for render
    const timer = setTimeout(updateHeight, 50);

    // Watch for size changes (async content loading like tweets)
    const observer = new ResizeObserver(updateHeight);
    observer.observe(currentRef);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [currentIndex]);

  const goToPreviousEmbed = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNextEmbed = useCallback(() => {
    if (currentIndex < filteredEmbeds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, filteredEmbeds.length]);

  const handleEmbedClick = useCallback(
    (event: React.MouseEvent, embedIndex?: number) => {
      event.stopPropagation();
      const index = embedIndex ?? currentIndex;
      const embed = filteredEmbeds[index];
      if (embed?.url) {
        openWindow(embed.url);
      }
    },
    [filteredEmbeds, currentIndex]
  );

  // Keyboard navigation using app hotkey infrastructure
  // Only enable when this carousel's parent cast is selected
  useAppHotkeys(
    'left',
    goToPreviousEmbed,
    {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
      enabled: isSelected && filteredEmbeds.length > 1,
    },
    [goToPreviousEmbed, isSelected, filteredEmbeds.length]
  );

  useAppHotkeys(
    'right',
    goToNextEmbed,
    {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
      enabled: isSelected && filteredEmbeds.length > 1,
    },
    [goToNextEmbed, isSelected, filteredEmbeds.length]
  );

  if (!filteredEmbeds || filteredEmbeds.length === 0) return null;

  // Single embed - no carousel UI needed (no transform, so intersection observer works)
  if (filteredEmbeds.length === 1) {
    return (
      <div className="max-w-lg self-start cursor-pointer" onClick={(e) => handleEmbedClick(e, 0)}>
        {renderEmbedForUrl({ ...filteredEmbeds[0], hideReactions })}
      </div>
    );
  }

  return (
    <div className="max-w-lg self-start">
      {/* Embed container with animated height */}
      <div
        className="overflow-hidden rounded-lg transition-[height] duration-300 ease-in-out"
        style={{ height: containerHeight === 'auto' ? 'auto' : `${containerHeight}px` }}
      >
        <div
          className="flex transition-transform duration-300 ease-in-out cursor-pointer"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          onClick={handleEmbedClick}
        >
          {filteredEmbeds.map((embed, index) => (
            <div
              key={`embed-${embed?.cast_id?.hash || embed?.castId?.hash || embed?.url || index}`}
              ref={(el) => {
                embedRefs.current[index] = el;
              }}
              className="w-full flex-shrink-0"
            >
              {renderEmbedForUrl({ ...embed, hideReactions, skipIntersection: true })}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation - compact row below content */}
      <div className="flex items-center justify-between mt-2 px-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-muted-foreground hover:text-foreground',
            currentIndex === 0 && 'opacity-30 cursor-not-allowed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            goToPreviousEmbed();
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Prev
        </Button>

        {/* Indicators */}
        <div className="flex items-center gap-1.5">
          {filteredEmbeds.map((_, index) => (
            <button
              key={index}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                index === currentIndex ? 'bg-foreground' : 'bg-muted-foreground/40 hover:bg-muted-foreground/60'
              )}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
          <span className="ml-1 text-xs text-muted-foreground">
            {currentIndex + 1}/{filteredEmbeds.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-muted-foreground hover:text-foreground',
            currentIndex === filteredEmbeds.length - 1 && 'opacity-30 cursor-not-allowed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            goToNextEmbed();
          }}
          disabled={currentIndex === filteredEmbeds.length - 1}
        >
          Next
          <ChevronRightIcon className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default EmbedCarousel;
