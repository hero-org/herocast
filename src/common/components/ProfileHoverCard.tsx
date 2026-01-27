import Link from 'next/link';
import type React from 'react';
import { memo } from 'react';
import { useInView } from 'react-intersection-observer';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useProfile } from '@/hooks/queries/useProfile';
import ProfileInfoContent from './ProfileInfoContent';

type ProfileHoverCardProps = {
  fid?: number;
  username?: string;
  viewerFid?: number;
  children: React.ReactNode;
  className?: string;
};

const ProfileHoverCard = memo(({ fid, username, viewerFid, children, className }: ProfileHoverCardProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  if (!username && !fid) return null;

  const effectiveViewerFid = viewerFid || Number(process.env.NEXT_PUBLIC_APP_FID!);

  const { data: profile } = useProfile(
    { fid, username },
    {
      viewerFid: effectiveViewerFid,
      includeAdditionalInfo: false,
      enabled: inView,
    }
  );

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger ref={ref} className={`${className} text-left`} asChild>
        <Link href={`/profile/${profile?.username || username}`} prefetch={false}>
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" className="border border-gray-400 overflow-hidden cursor-pointer">
        <Link href={`/profile/${profile?.username || username}`} prefetch={false} className="w-full text-left">
          <ProfileInfoContent profile={profile} isHoverCard={true} />
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
});

ProfileHoverCard.displayName = 'ProfileHoverCard';

export default ProfileHoverCard;
