import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';

export interface RecasterProfile {
  username?: string;
  fname?: string;
}

export type CastWithInclusionContext = FarcasterCast & {
  inclusion_context?: {
    is_following_recaster: boolean;
    is_following_author: boolean;
  };
};

export interface RecastBadgeProps {
  cast: CastWithInclusionContext;
  recastedByFid?: number;
  recasterProfile?: RecasterProfile | null;
}

export const RecastBadge: React.FC<RecastBadgeProps> = ({ cast, recastedByFid, recasterProfile }) => {
  const shouldShowBadge =
    'inclusion_context' in cast &&
    cast.inclusion_context?.is_following_recaster &&
    !cast.inclusion_context?.is_following_author;

  if (!recastedByFid && !shouldShowBadge) return null;

  // Use recasterProfile from React Query hook if recastedByFid is provided,
  // otherwise find the recaster from reaction data
  const recaster = recastedByFid ? recasterProfile : cast.reactions?.recasts?.[0];
  const recasterLabel = recaster ? ('username' in recaster ? recaster.username : recaster.fname) : null;

  const badge = (
    <span className={cn('ml-10', 'h-5 inline-flex truncate text-sm font-semibold text-foreground/60 hover:underline')}>
      <RefreshCw className="h-4 w-4 mt-0.5 mr-1" />
      {recasterLabel && `Recasted by ${recasterLabel}`}
    </span>
  );

  if (recasterLabel) {
    return (
      <Link href={`/profile/${recasterLabel}`} prefetch={false}>
        {badge}
      </Link>
    );
  }

  return badge;
};
