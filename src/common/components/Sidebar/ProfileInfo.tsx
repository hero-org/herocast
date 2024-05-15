import React, { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserDataForFidOrUsername } from "../../helpers/neynar";
import { PROFILE_UPDATE_INTERVAL, useDataStore } from "@/stores/useDataStore";
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
    if (!profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL) {
      getData();
    }
  }, [fid, viewerFid, profile]);

  return (
    <div className="space-y-2 min-h-72">
      <h2 className="text-md font-semibold break-all overflow-x-hidden line-clamp-1">
        {profile?.display_name}
      </h2>
      <div className="flex flex-row gap-x-2">
        <Avatar>
          <AvatarImage
            src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${profile?.pfp_url}`}
          />
          <AvatarFallback>{profile?.username.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="-mt-0.5 text-sm font-regular">
            @{profile?.username}{" "}
          </h3>
          <h3 className="text-sm font-regular text-muted-foreground flex flex-row">
            <span>
              {profile?.power_badge && (
                <img
                  src="/images/ActiveBadge.webp"
                  className="mt-0.5 mr-1.5 h-[15px] w-[15px]"
                  alt="power badge"
                />
              )}
            </span>
          </h3>
        </div>
      </div>
      {profile ? (
        <>
          <p className="flex pt-2 text-sm break-words pr-4 overflow-x-hidden">
            {profile.profile?.bio?.text}
          </p>
          <div className="flex flex-col pt-2 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">
                {profile.fid}
                &nbsp;
              </span>
              fid
            </p>
            <p>
              <span className="font-semibold text-foreground">
                {formatLargeNumber(profile.following_count)}
                &nbsp;
              </span>
              following
            </p>
            <p>
              <span className="font-semibold text-foreground">
                {formatLargeNumber(profile.follower_count)}
                &nbsp;
              </span>
              followers
            </p>
          </div>
        </>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default ProfileInfo;
