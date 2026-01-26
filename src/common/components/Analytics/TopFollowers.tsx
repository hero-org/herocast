import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBulkProfiles } from '@/hooks/queries/useBulkProfiles';
import { useAccountStore } from '@/stores/useAccountStore';
import { Loading } from '../Loading';
import ProfileInfoContent from '../ProfileInfoContent';

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

  // Fetch FIDs from API
  useEffect(() => {
    const getData = async () => {
      setIsFetchingFids(true);
      try {
        const response = await fetch(`/api/users/relevant-followers?target_fid=${fid}&viewer_fid=${viewerFid}`);
        if (!response.ok) {
          throw new Error('Failed to fetch relevant followers');
        }
        const data = await response.json();
        const topFids = (data.fids || []).slice(0, TOP_FOLLOWERS_LIMIT);
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
