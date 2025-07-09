import React, { useEffect, useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInView } from 'react-intersection-observer';
import { useDataStore } from '@/stores/useDataStore';
import { fetchAndAddUserProfile, shouldUpdateProfile } from '../../helpers/profileUtils';
import { getProfile } from '../../helpers/profileUtils';
import ProfileInfoContent from '../ProfileInfoContent';
import Link from 'next/link';
import { useMediaQuery } from '@/common/hooks/useMediaQuery';

type ProfileHoverCardProps = {
  fid?: number;
  username?: string;
  viewerFid?: number;
  children: React.ReactNode;
  className?: string;
};

const ProfileHoverCard = ({ fid, username, viewerFid, children, className }: ProfileHoverCardProps) => {
  const profile = useDataStore((state) => getProfile(state, username, fid?.toString()));
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isOpen, setIsOpen] = useState(false);

  if (!username && !fid) return <>{children}</>;

  useEffect(() => {
    if (!inView) return;

    const effectiveViewerFid = viewerFid || Number(process.env.NEXT_PUBLIC_APP_FID!);

    if (shouldUpdateProfile(profile)) {
      fetchAndAddUserProfile({ username, fid, viewerFid: effectiveViewerFid, skipAdditionalInfo: true });
    }
  }, [inView, username, fid, viewerFid, profile]);

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
          <div onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
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
        <div>
          {children}
        </div>
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