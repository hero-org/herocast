import React, { useEffect } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { openWindow } from "../helpers/navigation";
import { useInView } from "react-intersection-observer";
import { PROFILE_UPDATE_INTERVAL, useDataStore } from "@/stores/useDataStore";
import { getUserDataForFidOrUsername } from "../helpers/neynar";
import { getProfile } from "@/stores/useDataStore";
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
  const { addUserProfile } = useDataStore();
  const profile = useDataStore((state) => getProfile(state, username, fid));
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  if (!username && !fid) return null;

  useEffect(() => {
    if (!inView || profile) return;

    const getData = async () => {
      const users = await getUserDataForFidOrUsername({
        username,
        fid,
        viewerFid,
      });
      if (users.length) {
        users.forEach((user) => {
          addUserProfile({ user });
        });
      }
    };

    if (!profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL) {
      getData();
    }
  }, [inView, profile, viewerFid]);

  const onClick = () => {
    openWindow(
      `${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username || username}`
    );
  };

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <div onClick={onClick} ref={ref} className={className}>
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        className="border border-gray-400 overflow-hidden cursor-pointer"
      >
        <div onClick={onClick}>
          <ProfileInfoContent profile={profile} isHoverCard={true} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ProfileHoverCard;
