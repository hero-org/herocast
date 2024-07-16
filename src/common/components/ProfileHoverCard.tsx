import React, { useEffect } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { openWindow } from "../helpers/navigation";
import { useInView } from "react-intersection-observer";
import { PROFILE_UPDATE_INTERVAL, useDataStore } from "@/stores/useDataStore";
import { fetchAndAddUserProfile } from "../helpers/profileUtils";
import { getProfile } from "../helpers/profileUtils";
import ProfileInfoContent from "./ProfileInfoContent";

type ProfileHoverCardProps = {
  fid?: number;
  username?: string;
  viewerFid: number;
  children: React.ReactNode;
  className?: string;
};

const ProfileHoverCard = ({
  fid,
  username,
  viewerFid,
  children,
  className,
}: ProfileHoverCardProps) => {
  const profile = useDataStore((state) => getProfile(state, username, fid));
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  if (!username && !fid) return null;

  useEffect(() => {
    if (!inView || profile) return;

    if (!profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL) {
      fetchAndAddUserProfile({ username, fid, viewerFid });
    }
  }, [inView, profile, viewerFid, username, fid]);

  const onClick = () => {
    openWindow(
      `${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username || username}`
    );
  };

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button
          onClick={onClick}
          ref={ref}
          className={`${className} text-left`}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        className="border border-gray-400 overflow-hidden cursor-pointer"
      >
        <button onClick={onClick} className="w-full text-left">
          <ProfileInfoContent profile={profile} isHoverCard={true} />
        </button>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ProfileHoverCard;
