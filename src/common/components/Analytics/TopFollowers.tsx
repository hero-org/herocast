import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useAccountStore } from '@/stores/useAccountStore';
import Link from 'next/link';
import ProfileInfoContent from '../ProfileInfoContent';
import { getProfile, getProfileFetchIfNeeded } from '@/common/helpers/profileUtils';
import { useDataStore } from '@/stores/useDataStore';
import { Loading } from '../Loading';

const TOP_FOLLOWERS_LIMIT = 12;
const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

type TopFollowersProps = {
  fid: number;
};

const TopFollowers = ({ fid }: TopFollowersProps) => {
  const [topFollowerFids, setTopFollowerFids] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dataStore = useDataStore.getState();

  const viewerFid = Number(
    useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId) || APP_FID
  );

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      try {
        const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
        const fids = await neynarClient
          .fetchRelevantFollowers(fid, viewerFid)
          .then((response) => response.all_relevant_followers_dehydrated.map((follower) => follower.user?.fid));

        const topFids = fids.filter((fid) => fid !== undefined).slice(0, TOP_FOLLOWERS_LIMIT);
        setTopFollowerFids(topFids);
        topFids.forEach((fid) =>
          getProfileFetchIfNeeded({
            fid: fid?.toString(),
            viewerFid: viewerFid.toString(),
          })
        );
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    if (fid) {
      getData();
    }
  }, [fid]);

  const profiles = useMemo(
    () => topFollowerFids.map((fid) => getProfile(dataStore, undefined, fid.toString())).filter(Boolean),
    [dataStore, topFollowerFids]
  );

  return (
    <Card className="h-fit py-8 px-4">
      <CardContent className="items-start grid gap-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-flow-row">
        {isLoading && <Loading />}
        {profiles.map((profile) => (
          <div key={`top-follower-${profile.fid}`} className="flex items-center">
            <Link href={`/profile/${profile?.username}`} prefetch={false} className="w-full text-left">
              <ProfileInfoContent profile={profile} hideBio />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TopFollowers;
