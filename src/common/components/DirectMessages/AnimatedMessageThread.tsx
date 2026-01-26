import type React from 'react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type Message, MessageThread } from './MessageThread';

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
  const [prevKey, setPrevKey] = useState(conversationKey);
  const isNewConversation = conversationKey !== prevKey;

  useEffect(() => {
    if (isNewConversation) {
      setPrevKey(conversationKey);
    }
  }, [conversationKey, isNewConversation]);

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

  // Show loading skeleton only when switching conversations and no messages yet
  const showSkeleton = isNewConversation && messages.length === 0 && isLoading;

  return (
    <div className="relative h-full">
      {showSkeleton ? (
        <MessageSkeleton />
      ) : (
        <MessageThread
          messages={messages}
          viewerFid={viewerFid}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
