import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type SkeletonCastRowProps = {
  text?: string;
  className?: string;
};

const SkeletonCastRow = ({ text, className }: SkeletonCastRowProps) => {
  const randomDelay = Math.floor(Math.random() * 2000);
  return (
    <div className={cn('border-b border-foreground/20 relative w-full pr-4', className)}>
      <div className="flex items-start space-x-4 p-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" style={{ animationDelay: `${randomDelay + 100}ms` }} />
        <div className="flex-1 space-y-2 min-h-[80px]">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-32 rounded" style={{ animationDelay: `${randomDelay + 100}ms` }} />
            <Skeleton className="h-4 w-16 rounded" style={{ animationDelay: `${randomDelay + 100}ms` }} />
          </div>
          <div className="space-y-2">
            {text ? (
              <div className="flex space-x-2">{text}</div>
            ) : (
              <>
                <Skeleton className="h-4 w-full rounded" style={{ animationDelay: `${randomDelay + 300}ms` }} />
                <Skeleton className="h-4 w-5/6 rounded" style={{ animationDelay: `${randomDelay + 300}ms` }} />
                <Skeleton className="h-4 w-2/3 rounded" style={{ animationDelay: `${randomDelay + 300}ms` }} />
              </>
            )}
          </div>
          <div className="flex space-x-4 pt-1">
            <Skeleton className="h-6 w-12 rounded" style={{ animationDelay: `${randomDelay + 400}ms` }} />
            <Skeleton className="h-6 w-12 rounded" style={{ animationDelay: `${randomDelay + 400}ms` }} />
            <Skeleton className="h-6 w-12 rounded" style={{ animationDelay: `${randomDelay + 400}ms` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonCastRow;
