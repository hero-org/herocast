import React, { useEffect } from "react";
import {
  fetchAndAddUserProfile,
  shouldUpdateProfile,
} from "../../helpers/profileUtils";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import Link from "next/link";
import ProfileInfoContent from "../ProfileInfoContent";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ProfileInfo = ({
  fid,
  viewerFid,
  showFollowButton,
  showFullInfo,
}: {
  fid: number;
  viewerFid: number;
  showFollowButton?: boolean;
  showFullInfo?: boolean;
}) => {
  const profile = useDataStore((state) => get(state.fidToData, fid));

  useEffect(() => {
    if (shouldUpdateProfile(profile)) {
      fetchAndAddUserProfile({ fid, viewerFid });
    }
  }, [fid, viewerFid, profile]);

  const renderSocialCapitalScore = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {profile?.socialCapitalScore?.socialCapitalRank}
          </span>{" "}
          rank
        </TooltipTrigger>
        <TooltipContent
          className="w-44 p-3 bg-background border border-muted text-foreground/80"
          side="bottom"
          sideOffset={5}
        >
          <span>
            Social Capital Scores (SCS) are a measure of each Farcaster
            user&apos;s influence in the network. Learn more at{" "}
            <a
              target="_blank"
              rel="noreferrer"
              className="underline cursor-pointer"
              href="https://docs.airstack.xyz/airstack-docs-and-faqs/farcaster/farcaster/social-capital#social-capital-scores"
            >
              Airstack.xyz
            </a>
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const shouldRenderFullInfo =
    showFullInfo &&
    profile?.socialCapitalScore?.socialCapitalRank !== undefined;

    console.log('profile', profile) 
  return (
    <div className="space-y-2 mb-4 min-h-72 cursor-pointer block">
      <Link
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
      {shouldRenderFullInfo && (
        <div className="">{renderSocialCapitalScore()}</div>
      )}
    </div>
  );
};

export default ProfileInfo;
