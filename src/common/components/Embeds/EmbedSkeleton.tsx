import { cn } from '@/lib/utils';

type EmbedSkeletonVariant = 'default' | 'media' | 'social';

type EmbedSkeletonProps = {
  variant?: EmbedSkeletonVariant;
  className?: string;
};

/**
 * Static skeleton placeholder for embed loading states.
 * Use this to prevent layout shifts in carousels and feeds.
 *
 * Variants:
 * - default: Generic card skeleton for links/articles (aspect-ratio ~2:1)
 * - media: Square-ish skeleton for images/videos (aspect-ratio ~4:3)
 * - social: Tweet/cast-like skeleton with header + body
 */
export const EmbedSkeleton = ({ variant = 'default', className }: EmbedSkeletonProps) => {
  if (variant === 'media') {
    return <div className={cn('bg-muted/50 rounded-lg max-w-lg', 'aspect-[4/3] w-full', className)} />;
  }

  if (variant === 'social') {
    return (
      <div className={cn('bg-muted/50 rounded-lg border border-muted p-3 max-w-lg w-72', className)}>
        {/* Header: avatar + name */}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-2 w-16 bg-muted rounded" />
          </div>
        </div>
        {/* Body: text lines */}
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-4/5 bg-muted rounded" />
          <div className="h-3 w-3/5 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Default: generic card skeleton
  return (
    <div className={cn('bg-muted/50 rounded-lg border border-muted p-3 max-w-lg w-72', className)}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-muted rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 bg-muted rounded" />
          <div className="h-3.5 w-full bg-muted rounded" />
        </div>
      </div>
    </div>
  );
};

export default EmbedSkeleton;
