import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { openWindow } from '@/common/helpers/navigation';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { renderEmbedForUrl } from './index';

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

const PRELOAD_NEIGHBORS = 1;

const getEmbedKey = (embed: EmbedCarouselProps['embeds'][number], index: number) =>
  embed?.cast_id?.hash || embed?.castId?.hash || embed?.url || `embed-${index}`;

const EmbedCarousel = ({ embeds, hideReactions, isSelected }: EmbedCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const embedsKey = useMemo(() => embeds.map(getEmbedKey).join('|'), [embeds]);
  const renderedIndexes = useMemo(() => {
    const indexes: number[] = [];
    for (let index = currentIndex - PRELOAD_NEIGHBORS; index <= currentIndex + PRELOAD_NEIGHBORS; index++) {
      if (index >= 0 && index < embeds.length) {
        indexes.push(index);
      }
    }
    return new Set(indexes);
  }, [currentIndex, embeds.length]);

  // Reset state when embeds change
  useEffect(() => {
    setCurrentIndex(0);
    setContainerHeight(null);
  }, [embedsKey]);

  // Clamp index if the embed list shrinks while this carousel is mounted
  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, Math.max(embeds.length - 1, 0)));
  }, [embeds.length]);

  // Track height of current embed with ResizeObserver
  useLayoutEffect(() => {
    const currentRef = activeRef.current;
    if (!currentRef) return;

    const updateHeight = () => {
      const height = currentRef.offsetHeight;
      setContainerHeight(height > 0 ? height : null);
    };

    updateHeight();
    const raf = requestAnimationFrame(updateHeight);

    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(raf);
    }

    // Watch for size changes (async content loading like tweets)
    const observer = new ResizeObserver(updateHeight);
    observer.observe(currentRef);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [currentIndex, embedsKey, hideReactions]);

  const goToPreviousEmbed = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNextEmbed = useCallback(() => {
    if (currentIndex < embeds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, embeds.length]);

  const handleEmbedClick = useCallback(
    (event: React.MouseEvent, embedIndex?: number) => {
      event.stopPropagation();
      const index = embedIndex ?? currentIndex;
      const embed = embeds[index];
      if (embed?.url) {
        openWindow(embed.url);
      }
    },
    [embeds, currentIndex]
  );

  // Keyboard navigation using app hotkey infrastructure
  // Only enable when this carousel's parent cast is selected
  useAppHotkeys(
    'left',
    goToPreviousEmbed,
    {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
      enabled: isSelected && embeds.length > 1,
    },
    [goToPreviousEmbed, isSelected, embeds.length]
  );

  useAppHotkeys(
    'right',
    goToNextEmbed,
    {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
      enabled: isSelected && embeds.length > 1,
    },
    [goToNextEmbed, isSelected, embeds.length]
  );

  if (!embeds || embeds.length === 0) return null;

  // Single embed - no carousel UI needed (no transform, so intersection observer works)
  if (embeds.length === 1) {
    return (
      <div
        className="w-full min-w-0 max-w-lg self-start cursor-pointer overflow-hidden"
        onClick={(e) => handleEmbedClick(e, 0)}
      >
        {renderEmbedForUrl({ ...embeds[0], hideReactions })}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-lg self-start overflow-hidden">
      {/* Embed container with animated height */}
      <div
        className="relative overflow-hidden rounded-lg transition-[height] duration-300 ease-in-out"
        style={containerHeight ? { height: `${containerHeight}px` } : undefined}
      >
        {embeds.map((embed, index) => {
          if (!renderedIndexes.has(index)) return null;

          const isActive = index === currentIndex;
          return (
            <div
              key={`${getEmbedKey(embed, index)}-${index}`}
              ref={isActive ? activeRef : undefined}
              aria-hidden={isActive ? undefined : true}
              className={cn(
                'w-full min-w-0',
                isActive ? 'relative cursor-pointer' : 'invisible pointer-events-none absolute inset-x-0 top-0'
              )}
              onClick={isActive ? (event) => handleEmbedClick(event, index) : undefined}
            >
              {renderEmbedForUrl({ ...embed, hideReactions, skipIntersection: true })}
            </div>
          );
        })}
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
          {embeds.map((_, index) => (
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
            {currentIndex + 1}/{embeds.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-muted-foreground hover:text-foreground',
            currentIndex === embeds.length - 1 && 'opacity-30 cursor-not-allowed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            goToNextEmbed();
          }}
          disabled={currentIndex === embeds.length - 1}
        >
          Next
          <ChevronRightIcon className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default EmbedCarousel;
