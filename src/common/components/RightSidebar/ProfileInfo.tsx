import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserDataForFidOrUsername } from "../../helpers/neynar";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import FollowButton from "../FollowButton";
import { Loading } from "../Loading";

const ProfileInfo = ({
  fid,
  viewerFid,
}: {
  fid: number;
  viewerFid: number;
}) => {
  const { addUserProfile } = useDataStore();
  const profile = useDataStore((state) => get(state.fidToData, fid));

  useEffect(() => {
    const getData = async () => {
      const users = await getUserDataForFidOrUsername({
        fid,
        viewerFid,
      });
      if (users.length) {
        users.forEach((user) => {
          addUserProfile({ username: user.username, data: user });
        });
      }
    };

    getData();
  }, [fid, viewerFid]);

  return (
    <div className="space-y-2 min-h-72">
      <div className="flex flex-row justify-between">
        <Avatar>
          <AvatarImage src={profile?.pfp_url} />
          <AvatarFallback>{profile?.username.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <FollowButton username={profile?.username} />
      </div>
      <div>
        <h2 className="text-md font-semibold">{profile?.display_name}</h2>
        <h3 className="text-sm font-regular">@{profile?.username} </h3>
      </div>
      {profile ? (
        <>
          <span>
            {profile.active_status && (
              <img
                src="/images/ActiveBadge.webp"
                className="ml-2 mt-0.5 h-[17px] w-[17px]"
                alt="power badge"
              />
            )}
          </span>
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
  );
};

export default ProfileInfo;
