import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  /** Type of skeleton to show */
  variant?: 'feed' | 'profile' | 'settings' | 'list' | 'generic';
  /** Number of skeleton items to show for feed variant */
  itemCount?: number;
  /** Optional className */
  className?: string;
}

function FeedSkeleton({ itemCount = 5 }: { itemCount: number }) {
  return (
    <div className="w-full">
      {Array.from({ length: itemCount }).map((_, idx) => (
        <div key={idx} className="border-b border-foreground/20 relative w-full pr-4">
          <div className="flex items-start gap-x-2 p-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 min-h-[80px]">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
              <div className="flex space-x-4 pt-1">
                <Skeleton className="h-6 w-12 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="w-full p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-full max-w-md rounded" />
        </div>
      </div>
      {/* Stats */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
      </div>
      {/* Content */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded" />
        <FeedSkeleton itemCount={3} />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="w-full p-4 space-y-6 max-w-2xl">
      <Skeleton className="h-8 w-48 rounded" />
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="w-full p-4 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

export function PageSkeleton({ variant = 'generic', itemCount = 5, className }: PageSkeletonProps) {
  return (
    <div className={cn('w-full h-full', className)}>
      {variant === 'feed' && <FeedSkeleton itemCount={itemCount} />}
      {variant === 'profile' && <ProfileSkeleton />}
      {variant === 'settings' && <SettingsSkeleton />}
      {variant === 'list' && <ListSkeleton />}
      {variant === 'generic' && <GenericSkeleton />}
    </div>
  );
}

export { FeedSkeleton, ProfileSkeleton, SettingsSkeleton, ListSkeleton, GenericSkeleton };
