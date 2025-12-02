import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAccountStore } from '@/stores/useAccountStore';
import Link from 'next/link';
import ProfileInfoContent from '../ProfileInfoContent';
import { Loading } from '../Loading';
import { UnfollowData } from '@/common/types/types';
import { useBulkProfiles } from '@/hooks/queries/useBulkProfiles';

const RECENT_UNFOLLOWERS_LIMIT = 12;
const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

type RecentUnfollowsProps = {
  fid: number;
  unfollows: UnfollowData[];
};

const RecentUnfollows = ({ fid, unfollows }: RecentUnfollowsProps) => {
  const viewerFid = Number(
    useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId) || APP_FID
  );

  // Get FIDs from unfollows prop
  const unfollowFids = useMemo(
    () =>
      unfollows
        .filter((unfollow) => unfollow.target_fid !== undefined)
        .slice(0, RECENT_UNFOLLOWERS_LIMIT)
        .map((unfollow) => unfollow.target_fid),
    [unfollows]
  );

  // Fetch profiles using React Query
  const { data: profiles = [], isLoading } = useBulkProfiles(unfollowFids, {
    viewerFid,
    enabled: unfollowFids.length > 0,
  });

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
