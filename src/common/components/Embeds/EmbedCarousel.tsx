import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { renderEmbedForUrl } from './index';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';

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
  onEmbedClick?: () => void;
};

const EmbedCarousel = ({ embeds, hideReactions, onEmbedClick }: EmbedCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to first embed when embeds change
  useEffect(() => {
    setCurrentIndex(0);
  }, [embeds]);

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

  // Keyboard navigation using app hotkey infrastructure
  useAppHotkeys(
    'left',
    goToPreviousEmbed,
    {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
    },
    [goToPreviousEmbed]
  );

  useAppHotkeys(
    'right',
    goToNextEmbed,
    {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
    },
    [goToNextEmbed]
  );

  if (!embeds || embeds.length === 0) return null;

  // Single embed - no carousel UI needed
  if (embeds.length === 1) {
    return (
      <div className="max-w-lg self-start cursor-pointer" onClick={onEmbedClick}>
        {renderEmbedForUrl({ ...embeds[0], hideReactions })}
      </div>
    );
  }


  return (
    <div className="max-w-lg self-start">
      {/* Embed container - auto height */}
      <div className="overflow-hidden rounded-lg">
        <div
          className="flex transition-transform duration-300 ease-in-out cursor-pointer"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          onClick={onEmbedClick}
        >
          {embeds.map((embed, index) => (
            <div
              key={`embed-${embed?.cast_id?.hash || embed?.castId?.hash || embed?.url || index}`}
              className="w-full flex-shrink-0"
            >
              {renderEmbedForUrl({ ...embed, hideReactions })}
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
