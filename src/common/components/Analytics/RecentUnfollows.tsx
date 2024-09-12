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
  const [isLoading, setIsLoading] = useState(false);
  const dataStore = useDataStore.getState();
  const viewerFid = Number(
    useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId) || APP_FID
  );

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      try {
        const recentUnfollows = unfollows
          .filter((unfollow) => unfollow.target_fid !== undefined)
          .slice(0, RECENT_UNFOLLOWERS_LIMIT);

        recentUnfollows.forEach((unfollow) =>
          getProfileFetchIfNeeded({
            fid: unfollow.target_fid.toString(),
            viewerFid: viewerFid.toString(),
          })
        );
      } catch (e) {
        console.error('Error fetching recent unfollows:', e);
      } finally {
        setIsLoading(false);
      }
    };
    if (fid && unfollows.length > 0) {
      getData();
    }
  }, [fid, unfollows]);

  const profiles = useMemo(
    () => unfollows.map((unfollow) => getProfile(dataStore, undefined, unfollow.target_fid.toString())).filter(Boolean),
    [dataStore, unfollows]
  );

  return (
    <Card className="h-fit py-8 px-4">
      <CardContent className="items-start grid gap-8 grid-cols-2 grid-flow-row">
        {isLoading && <Loading />}
        {profiles.map((profile) => (
          <div key={`recent-unfollower-${profile.fid}`} className="flex items-center">
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
