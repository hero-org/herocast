import React, { useEffect, useState } from 'react';
import { MessageThread, Message } from './MessageThread';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
// import { DMErrorBoundary } from './DMErrorBoundary';

interface AnimatedMessageThreadProps {
  messages: Message[];
  viewerFid: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  conversationKey: string; // Unique key to trigger animation on change
}

export const AnimatedMessageThread: React.FC<AnimatedMessageThreadProps> = ({
  messages,
  viewerFid,
  onLoadMore,
  hasMore,
  isLoading,
  conversationKey,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentKey, setCurrentKey] = useState(conversationKey);
  const [displayMessages, setDisplayMessages] = useState(messages);

  useEffect(() => {
    if (conversationKey !== currentKey) {
      // Start transition
      setIsTransitioning(true);

      // After fade out completes, update content
      setTimeout(() => {
        setCurrentKey(conversationKey);
        setDisplayMessages(messages);
        // Start fade in after a brief pause
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 200);
    } else {
      // Just update messages if same conversation
      setDisplayMessages(messages);
    }
  }, [conversationKey, currentKey, messages]);

  // Loading skeleton
  const MessageSkeleton = () => (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={cn('flex gap-3', i % 2 === 0 ? 'flex-row' : 'flex-row-reverse')}>
          {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
          <div className={cn('flex flex-col gap-1 max-w-[70%]', i % 2 === 0 ? 'items-start' : 'items-end')}>
            {i % 2 === 0 && <Skeleton className="h-3 w-24 mb-1" />}
            <Skeleton className={cn('h-16 rounded-2xl bg-muted animate-pulse', i % 2 === 0 ? 'w-48' : 'w-56')} />
          </div>
        </div>
      ))}
    </div>
  );

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    // No animations for users who prefer reduced motion
    return (
      <MessageThread
        messages={displayMessages}
        viewerFid={viewerFid}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="relative h-full">
      {/* Loading skeleton overlay */}
      <div
        className={cn(
          'absolute inset-0 z-10 bg-background transition-opacity duration-200',
          isTransitioning ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <MessageSkeleton />
      </div>

      {/* Actual message thread */}
      <div className={cn('h-full transition-opacity duration-200', isTransitioning ? 'opacity-0' : 'opacity-100')}>
        <MessageThread
          messages={displayMessages}
          viewerFid={viewerFid}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
