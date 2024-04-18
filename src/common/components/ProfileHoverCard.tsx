import React, { useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { openWindow } from "../helpers/navigation";
import { Loading } from "./Loading";
import { useInView } from "react-intersection-observer";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import FollowButton from "./FollowButton";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";

type ProfileHoverCardProps = {
  fid?: number;
  username?: string;
  viewerFid: number;
  children: React.ReactNode;
};

const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

const getProfile = (dataStoreState, username, fid) => {
  if (username) {
    return get(dataStoreState.usernameToData, username);
  } else {
    return get(dataStoreState.fidToData, fid);
  }
}

const ProfileHoverCard = ({
  fid,
  username,
  viewerFid,
  children,
}: ProfileHoverCardProps) => {
  const { addUserProfile, usernameToData } = useDataStore();
  const profile = useDataStore((state) => getProfile(state, username, fid));
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  if (!username && !fid) return null;

  useEffect(() => {
    if (!inView || profile) return;

    const getData = async () => {
      try {
        let users: User[] = [];
        if (username) {
          const resp = await neynarClient.searchUser(username, viewerFid);
          users = resp?.result?.users;
        } else if (fid) {
          const resp = await neynarClient.fetchBulkUsers([fid], { viewerFid });
          users = resp?.users;
        }
        if (users.length) {
          users.forEach((user) => {
            addUserProfile({ username: user.username, data: user });
          });
        }
      } catch (err) {
        console.log("ProfileHoverCard: err getting data", err);
      }
    };

    getData();
  }, [inView, profile, viewerFid]);

  const onClick = () => {
    openWindow(
      `${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username || username}`
    );
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
              <AvatarImage src={profile?.pfp_url} />
              <AvatarFallback>{username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <FollowButton username={profile?.username} />
          </div>
          <div>
            <h2 className="text-md font-semibold">{profile?.display_name}</h2>
            <h3 className="text-sm font-regular">@{username}</h3>
          </div>
          {profile ? (
            <>
              <p className="flex pt-2 text-sm break-words">
                {profile?.profile?.bio?.text}
              </p>
              <div className="flex items-center pt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {profile?.following_count}
                  &nbsp;
                </span>
                following
                <span className="ml-2 font-semibold text-foreground">
                  {profile?.follower_count}
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
