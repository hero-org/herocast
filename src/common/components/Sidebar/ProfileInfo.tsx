import React, { useEffect } from "react";
import {
  fetchAndAddUserProfile,
  shouldUpdateProfile,
} from "../../helpers/profileUtils";
import { useDataStore } from "@/stores/useDataStore";
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
  const profile = useDataStore((state) => get(state.fidToData, fid));

  useEffect(() => {
    if (shouldUpdateProfile(profile)) {
      fetchAndAddUserProfile({ fid, viewerFid });
    }
  }, [fid, viewerFid, profile]);

  return (
    <Link
      className="space-y-2 min-h-72 cursor-pointer block"
      href={`${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username}`}
      prefetch={false}
    >
      <ProfileInfoContent
        profile={profile}
        showFollowButton={showFollowButton}
      />
      {profile?.power_badge && (
        <div className="text-sm font-normal text-muted-foreground flex flex-row mt-2">
          <img
            src="/images/ActiveBadge.webp"
            className="h-[15px] w-[15px]"
            alt="Power badge"
          />
        </div>
      )}
    </Link>
  );
};

export default ProfileInfo;
