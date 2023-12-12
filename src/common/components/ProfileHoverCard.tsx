import React, { useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchUserProfile } from "../helpers/neynar";
import { openWindow } from "../helpers/navigation";
import { Loading } from "./Loading";
import { useInView } from "react-intersection-observer";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";

type ProfileHoverCardProps = {
  username: string;
  userFid: string | number;
  children: React.ReactNode;
};

const ProfileHoverCard = ({
  userFid,
  username,
  children,
}: ProfileHoverCardProps) => {
  const { addUserProfile } = useDataStore();

  const profile = useDataStore((state) => get(state.usernameToData, username));

  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  useEffect(() => {
    if (!inView || profile) return;

    const getData = async () => {
      const data = await fetchUserProfile(userFid, username);
      if (data) {
        addUserProfile({ username, data });
      }
    };

    getData();
  }, [inView, profile]);

  const onClick = () => {
    openWindow(`${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username || username}`);
  };

  const updateFollowStatus = (following: boolean | undefined) => async () => {
    if (following === undefined) return;
  };

  return (
    <HoverCard openDelay={0.1}>
      <HoverCardTrigger onClick={onClick} ref={ref}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        onClick={onClick}
        side="right"
        className="border border-gray-400 overflow-hidden"
      >
        <div className="space-y-2">
          <div className="flex flex-row justify-between">
            <Avatar>
              <AvatarImage src={profile?.pfp.url} />
              <AvatarFallback>{username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {/* <Button
                            className="rounded-sm group"
                            onClick={(e) => {e.stopPropagation(); updateFollowStatus(profile?.viewerContext.following)}}
                        >
                            <span className="block group-hover:hidden">{profile?.viewerContext.following ? "Following" : "Follow"}</span>
                            <span className="hidden group-hover:block group-hover:text-red-600">Unfollow</span>
                        </Button> */}
          </div>
          <div>
            <h2 className="text-md font-semibold">{profile?.displayName}</h2>
            <h3 className="text-sm font-regular">@{username}</h3>
          </div>
          {profile ? (
            <>
              <p className="flex pt-2 text-sm break-words">
                {profile?.profile?.bio?.text}
              </p>
              <div className="flex items-center pt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {profile?.followingCount}
                  &nbsp;
                </span>
                following
                <span className="ml-2 font-semibold text-foreground">
                  {profile?.followerCount}
                  &nbsp;
                </span>
                followers
              </div>
            </>
          ) : (
            <Loading />
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ProfileHoverCard;
