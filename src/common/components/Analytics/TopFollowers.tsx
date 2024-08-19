import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import Link from "next/link";
import ProfileInfoContent from "../ProfileInfoContent";
import {
  getProfile,
  getProfileFetchIfNeeded,
} from "@/common/helpers/profileUtils";
import { useDataStore } from "@/stores/useDataStore";

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
type TopFollowersProps = {
  fid: number;
};

const TopFollowers = ({ fid }: TopFollowersProps) => {
  const [topFollowerFids, setTopFollowerFids] = useState<string[]>([]);
  const viewerFid = Number(
    useAccountStore(
      (state) => state.accounts[state.selectedAccountIdx]?.platformAccountId
    ) || APP_FID
  );
  useEffect(() => {
    const getData = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const fids = await neynarClient
        .fetchRelevantFollowers(fid, viewerFid)
        .then((response) =>
          response.all_relevant_followers_dehydrated
            .map((follower) => follower.user?.fid)
            .slice(0, 12)
        );
      setTopFollowerFids(fids);
      fids.forEach((fid) =>
        getProfileFetchIfNeeded({
          fid: fid?.toString(),
          viewerFid: viewerFid.toString(),
        })
      );
    };
    if (fid) {
      getData();
    }
  }, [fid]);

  console.log("topFollowerFids", topFollowerFids);
  const profiles = useMemo(() => {
    const dataStore = useDataStore.getState();
    const followers = topFollowerFids.map((fid) =>
      getProfile(dataStore, undefined, fid)
    );
    return followers.filter((follower) => follower !== undefined);
  }, [topFollowerFids]);
  console.log("profiles", profiles);
  return (
    <Card className="h-fit py-8 px-4">
      <CardContent className="items-start grid gap-8 grid-cols-2 grid-flow-row">
        {profiles.map((profile) => (
          <div
            key={`top-follower-${profile.fid}`}
            className="flex items-center"
          >
            <Link
              href={`/profile/${profile?.username}`}
              prefetch={false}
              className="w-full text-left"
            >
              <ProfileInfoContent profile={profile} isHoverCard={true} />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TopFollowers;
