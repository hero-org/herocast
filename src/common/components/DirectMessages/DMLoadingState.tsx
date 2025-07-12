import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface DMLoadingStateProps {
  itemCount?: number;
}

export const DMLoadingState: React.FC<DMLoadingStateProps> = ({ itemCount = 5 }) => {
  return (
    <div className="space-y-0">
      {[...Array(itemCount)].map((_, idx) => (
        <div key={idx} className="flex gap-x-3 px-4 py-3 border-b border-muted/50">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
};
