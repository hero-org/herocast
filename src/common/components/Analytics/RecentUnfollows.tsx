import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useAccountStore } from '@/stores/useAccountStore';
import Link from 'next/link';
import ProfileInfoContent from '../ProfileInfoContent';
import { getProfile, getProfileFetchIfNeeded } from '@/common/helpers/profileUtils';
import { useDataStore } from '@/stores/useDataStore';
import { Loading } from '../Loading';
import { CombinedActivityData } from '@/common/types/types';

const RECENT_UNFOLLOWERS_LIMIT = 12;
const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
type RecentUnfollowsProps = {
  fid: number;
  unfollowFids: number[];
};

const RecentUnfollows = ({ fid, unfollowFids }: RecentUnfollowsProps) => {
  const [recentUnfollowsFids, setRecentUnfollowsFids] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dataStore = useDataStore.getState();

  const viewerFid = Number(
    useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId) || APP_FID
  );

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      try {
        setRecentUnfollowsFids(unfollowFids.filter((fid) => fid !== undefined).slice(0, RECENT_UNFOLLOWERS_LIMIT));
        unfollowFids.forEach((fid) =>
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
  }, [fid, unfollowFids]);

  const profiles = useMemo(() => {
    const unfollowsProfiles = recentUnfollowsFids.map((fid) => getProfile(dataStore, undefined, fid.toString()));
    return unfollowsProfiles.filter((unfollowProfile) => unfollowProfile !== undefined);
  }, [dataStore, recentUnfollowsFids]);

  return (
    <Card className="h-fit py-8 px-4">
      <CardContent className="items-start grid gap-8 grid-cols-2 grid-flow-row">
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

export default RecentUnfollows;
