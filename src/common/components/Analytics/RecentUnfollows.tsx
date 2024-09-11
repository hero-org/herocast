import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAccountStore } from '@/stores/useAccountStore';
import Link from 'next/link';
import ProfileInfoContent from '../ProfileInfoContent';
import { getProfile, getProfileFetchIfNeeded } from '@/common/helpers/profileUtils';
import { useDataStore } from '@/stores/useDataStore';
import { Loading } from '../Loading';
import { UnfollowData } from '@/common/types/types';

const RECENT_UNFOLLOWERS_LIMIT = 12;
const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
type RecentUnfollowsProps = {
  fid: number;
  unfollows: UnfollowData[];
};

const RecentUnfollows = ({ fid, unfollows }: RecentUnfollowsProps) => {
  const [recentUnfollows, setRecentUnfollows] = useState<UnfollowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dataStore = useDataStore.getState();

  const viewerFid = Number(
    useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId) || APP_FID
  );

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      try {
        setRecentUnfollows(
          unfollows
            .map((unfollow) => unfollow.target_fid) // Extract target_fid from each UnfollowData object
            .filter((fid) => fid !== undefined) // Filter out undefined values
            .slice(0, RECENT_UNFOLLOWERS_LIMIT) // Limit the array to RECENT_UNFOLLOWERS_LIMIT
        );
        unfollows.forEach((fid) =>
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
  }, [fid, unfollows]);

  const profiles = useMemo(() => {
    const unfollowsProfiles = recentUnfollows.map((fid) => getProfile(dataStore, undefined, fid.toString()));
    return unfollowsProfiles.filter((unfollowProfile) => unfollowProfile !== undefined);
  }, [dataStore, recentUnfollows]);

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
