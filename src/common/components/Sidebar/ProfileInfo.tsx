import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserDataForFidOrUsername } from "../../helpers/neynar";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import FollowButton from "../FollowButton";
import { Loading } from "../Loading";
import { formatLargeNumber } from "../../helpers/text";

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
          addUserProfile({ user });
        });
      }
    };

    getData();
  }, [fid, viewerFid]);

  return (
    <div className="space-y-2 min-h-72">
      <div className="flex flex-row gap-x-2 justify-between">
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
                className="mt-0.5 h-[15px] w-[15px]"
                alt="power badge"
              />
            )}
          </span>
          <div className="flex flex-col pt-2 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">
                {formatLargeNumber(profile?.following_count)}
                &nbsp;
              </span>
              following
            </p>
            <p>
              <span className="font-semibold text-foreground">
                {formatLargeNumber(profile?.follower_count)}
                &nbsp;
              </span>
              followers
            </p>
          </div>
           <p className="flex pt-2 text-sm break-words">
            {profile?.profile?.bio?.text}
          </p>
        </>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default ProfileInfo;
