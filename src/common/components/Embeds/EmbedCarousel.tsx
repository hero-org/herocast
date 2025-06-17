import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
  onEmbedClick?: () => void;
};

const EmbedCarousel = ({ embeds, hideReactions, onEmbedClick }: EmbedCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to first embed when embeds change
  useEffect(() => {
    setCurrentIndex(0);
  }, [embeds]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < embeds.length - 1) {
        e.preventDefault();
        setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, embeds.length]);

  if (!embeds || embeds.length === 0) return null;

  // Single embed - no carousel UI needed
  if (embeds.length === 1) {
    return (
      <div className="max-w-lg self-start cursor-pointer" onClick={onEmbedClick}>
        {renderEmbedForUrl({ ...embeds[0], hideReactions })}
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : 0);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex < embeds.length - 1 ? currentIndex + 1 : embeds.length - 1);
  };

  return (
    <div className="max-w-lg self-start">
      <div className="relative overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900" style={{ height: '280px' }}>
        {/* Embed container */}
        <div
          className="flex transition-transform duration-300 ease-in-out h-full cursor-pointer"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          onClick={onEmbedClick}
        >
          {embeds.map((embed, index) => (
            <div
              key={`embed-${embed?.cast_id?.hash || embed?.castId?.hash || embed?.url || index}`}
              className="w-full flex-shrink-0 flex items-center justify-center p-2"
            >
              <div className="max-w-full max-h-full overflow-hidden">
                {renderEmbedForUrl({ ...embed, hideReactions })}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation buttons */}
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 opacity-75 hover:opacity-100',
            currentIndex === 0 && 'opacity-30 cursor-not-allowed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 opacity-75 hover:opacity-100',
            currentIndex === embeds.length - 1 && 'opacity-30 cursor-not-allowed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={currentIndex === embeds.length - 1}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Indicators */}
      <div className="flex justify-center mt-2 gap-1">
        {embeds.map((_, index) => (
          <button
            key={index}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              index === currentIndex
                ? 'bg-blue-500'
                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
            )}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          {currentIndex + 1}/{embeds.length}
        </span>
      </div>
    </div>
  );
};

export default EmbedCarousel;
