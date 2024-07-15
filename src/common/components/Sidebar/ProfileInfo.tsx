import React, { useEffect } from "react";
import { getUserDataForFidOrUsername } from "../../helpers/neynar";
import { PROFILE_UPDATE_INTERVAL, useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import Link from "next/link";
import ProfileInfoContent from "../ProfileInfoContent";

const ProfileInfo = ({
  fid,
  viewerFid,
  showFollowButton,
}: {
  fid: number;
  viewerFid: number;
  showFollowButton?: boolean;
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
    <Link
      className="space-y-2 min-h-72 cursor-pointer"
      href={`${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username}`}
      prefetch={false}
    >
      <ProfileInfoContent profile={profile} showFollowButton={showFollowButton} />
      {profile?.power_badge && (
        <h3 className="text-sm font-regular text-muted-foreground flex flex-row">
          <span>
            <img
              src="/images/ActiveBadge.webp"
              className="mt-0.5 mr-1.5 h-[15px] w-[15px]"
              alt="power badge"
            />
          </span>
        </h3>
      )}
    </Link>
  );
};

export default ProfileInfo;
