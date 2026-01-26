import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useMediaQuery } from '@/common/hooks/useMediaQuery';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProfile } from '@/hooks/queries/useProfile';
import ProfileInfoContent from '../ProfileInfoContent';

type ProfileHoverCardProps = {
  fid?: number;
  username?: string;
  viewerFid?: number;
  children: React.ReactNode;
  className?: string;
};

const ProfileHoverCard = ({ fid, username, viewerFid, children, className }: ProfileHoverCardProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isOpen, setIsOpen] = useState(false);

  if (!username && !fid) return <>{children}</>;

  const effectiveViewerFid = viewerFid || Number(process.env.NEXT_PUBLIC_APP_FID!);

  const { data: profile } = useProfile(
    { fid, username },
    {
      viewerFid: effectiveViewerFid,
      includeAdditionalInfo: false,
      enabled: inView,
    }
  );

  const profileContent = (
    <Link href={`/profile/${profile?.username || username}`} prefetch={false} className="w-full text-left">
      <ProfileInfoContent profile={profile} isHoverCard={true} />
    </Link>
  );

  // On mobile, use Popover for tap interactions
  if (isMobile) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger ref={ref} className={`${className} text-left`} asChild>
          <div onClick={(e) => e.stopPropagation()}>{children}</div>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          className="w-80 border border-gray-400 overflow-hidden cursor-pointer p-4"
          align="start"
          avoidCollisions={true}
          onClick={() => setIsOpen(false)}
        >
          {profileContent}
        </PopoverContent>
      </Popover>
    );
  }

  // On desktop, use HoverCard
  return (
    <HoverCard openDelay={500}>
      <HoverCardTrigger ref={ref} className={`${className} text-left`} asChild>
        <div>{children}</div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        className="w-80 border border-gray-400 overflow-hidden cursor-pointer"
        align="start"
        avoidCollisions={true}
      >
        {profileContent}
      </HoverCardContent>
    </HoverCard>
  );
};

export default ProfileHoverCard;
