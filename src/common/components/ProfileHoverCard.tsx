import React, { useEffect } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useInView } from "react-intersection-observer";
import { useDataStore } from "@/stores/useDataStore";
import {
  fetchAndAddUserProfile,
  shouldUpdateProfile,
} from "../helpers/profileUtils";
import { getProfile } from "../helpers/profileUtils";
import ProfileInfoContent from "./ProfileInfoContent";
import Link from "next/link";
import { useMemo } from "react";

type ProfileHoverCardProps = {
  fid?: number;
  username?: string;
  viewerFid?: number;
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
  const profile = useDataStore((state) =>
    getProfile(state, username, fid?.toString()),
  );
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  if (!username && !fid) return null;

  useEffect(() => {
    if (!inView) return;

    const effectiveViewerFid =
      viewerFid || Number(process.env.NEXT_PUBLIC_APP_FID!);

    if (shouldUpdateProfile(profile)) {
      fetchAndAddUserProfile({ username, fid, viewerFid: effectiveViewerFid });
    }
  }, [inView, username, fid]);

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger ref={ref} className={`${className} text-left`}>
        <Link
          href={`/profile/${profile?.username || username}`}
          prefetch={false}
        >
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        className="border border-gray-400 overflow-hidden cursor-pointer"
      >
        <Link
          href={`/profile/${profile?.username || username}`}
          prefetch={false}
          className="w-full text-left"
        >
          <ProfileInfoContent profile={profile} isHoverCard={true} />
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ProfileHoverCard;
