import type React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const MessageSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {/* Single incoming message skeleton */}
        <div className="flex gap-3 flex-row">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex flex-col gap-1 items-start">
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-12 w-48 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Input area placeholder */}
      <div className="flex-shrink-0 border-t border-muted px-4 py-3 bg-background">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
};
