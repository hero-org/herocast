import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useAccountStore } from '@/stores/useAccountStore';
import Link from 'next/link';
import ProfileInfoContent from '../ProfileInfoContent';
import { Loading } from '../Loading';
import { useBulkProfiles } from '@/hooks/queries/useBulkProfiles';

const TOP_FOLLOWERS_LIMIT = 12;
const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

type TopFollowersProps = {
  fid: number;
};

const TopFollowers = ({ fid }: TopFollowersProps) => {
  const [topFollowerFids, setTopFollowerFids] = useState<number[]>([]);
  const [isFetchingFids, setIsFetchingFids] = useState(false);

  const viewerFid = Number(
    useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId) || APP_FID
  );

  // Fetch FIDs from Neynar API
  useEffect(() => {
    const getData = async () => {
      setIsFetchingFids(true);
      try {
        const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
        const fids = await neynarClient
          .fetchRelevantFollowers(fid, viewerFid)
          .then((response) => response.all_relevant_followers_dehydrated.map((follower) => follower.user?.fid));

        const topFids = fids.filter((fid): fid is number => fid !== undefined).slice(0, TOP_FOLLOWERS_LIMIT);
        setTopFollowerFids(topFids);
      } catch (e) {
        console.error(e);
      } finally {
        setIsFetchingFids(false);
      }
    };
    if (fid) {
      getData();
    }
  }, [fid, viewerFid]);

  // Fetch profiles using React Query
  const { data: profiles = [], isLoading: isLoadingProfiles } = useBulkProfiles(topFollowerFids, {
    viewerFid,
    enabled: topFollowerFids.length > 0,
  });

  const isLoading = isFetchingFids || isLoadingProfiles;

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
