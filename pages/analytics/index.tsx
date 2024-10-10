import NewFollowersCard from '@/common/components/Analytics/NewFollowersCard';
import ReactionsCard from '@/common/components/Analytics/ReactionsCard';
import CastReactionsTable from '@/common/components/Analytics/CastReactionsTable';
import { createClient } from '@/common/helpers/supabase/component';
import { AnalyticsData } from '@/common/types/types';
import { useAccountStore } from '@/stores/useAccountStore';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import get from 'lodash.get';
import { Loading } from '@/common/components/Loading';
import { ProfileSearchDropdown } from '@/common/components/ProfileSearchDropdown';
import { getUserDataForFidOrUsername } from '@/common/helpers/neynar';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useAuth } from '@/common/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ChartBarIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import ClickToCopyText from '@/common/components/ClickToCopyText';
import { Interval } from '@/common/types/types';
import { IntervalFilter } from '@/common/components/IntervalFilter';
import DynamicChartCard from '@/common/components/Analytics/DynamicChartCard';
import { addDays, formatDistanceToNow, isBefore } from 'date-fns';
import { Carousel, CarouselContent, CarouselItem, CarouselNext } from '@/components/ui/carousel';
import CastsCard from '@/common/components/Analytics/CastsCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TopFollowers from '@/common/components/Analytics/TopFollowers';
import { UTCDate } from '@date-fns/utc';
import { getPlanLimitsForPlan } from '@/config/planLimits';
import { isPaidUser } from '@/stores/useUserStore';
import UpgradeFreePlanCard from '@/common/components/UpgradeFreePlanCard';
import { ArrowRightIcon } from '@heroicons/react/24/solid';
import RecentUnfollows from '@/common/components/Analytics/RecentUnfollows';

type FidToAnalyticsData = Record<string, AnalyticsData>;
const intervals = [Interval.d7, Interval.d30, Interval.d90];
const LANDING_PAGE_DEFAULT_FID = '3';

function timeUntilNextUTCHour(hour: number): string {
  const now = new Date();

  // Create a Date object for <hour> UTC today
  let next4amUTC = new UTCDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0);

  // If the current time is already past <hour> UTC, move to the next day
  if (isBefore(next4amUTC, now)) {
    next4amUTC = addDays(next4amUTC, 1);
  }

  return formatDistanceToNow(next4amUTC, { addSuffix: true });
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { query } = router;
  const supabaseClient = createClient();

  const [interval, setInterval] = useState<Interval>(intervals[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [fidToAnalytics, setAnalyticsData] = useState<FidToAnalyticsData>({});
  const selectedAccountInApp = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const { accounts } = useAccountStore();
  const isCustomer = isPaidUser();

  const disabledIntervals = useMemo(() => {
    if (isCustomer) return [];

    const enabeldIntervals = getPlanLimitsForPlan('openSource').analyticsEnabledInterval;
    return intervals.filter((i) => !enabeldIntervals.includes(i));
  }, [isCustomer]);

  const defaultProfiles = useMemo(() => {
    return accounts.filter((account) => account.status === 'active').map((a) => a.user) as User[];
  }, [accounts]);

  const [selectedProfile, setSelectedProfile] = useState<User>();
  const fid = get(selectedProfile, 'fid')?.toString();

  useEffect(() => {
    if (!fid) return;

    const fetchAnalytics = async (fid: string) => {
      const { data: analyticsRow, error } = await supabaseClient
        .from('analytics')
        .select('*')
        .eq('fid', fid)
        .maybeSingle();
      if (error) {
        console.error('Error fetching analytics:', error);
        return false;
      }
      return analyticsRow;
    };
    const refreshForNewFid = async (fid: string) => {
      if (!fid) return;

      let analyticsRow = await fetchAnalytics(fid);
      if (!analyticsRow && user) {
        console.error('No analytics found for fid:', fid);
        const { data, error } = await supabaseClient.functions.invoke('create-analytics-data', {
          body: JSON.stringify({ fid }),
        });
        if (error) {
          console.error('Error invoking create-analytics-data:', error);
        } else {
          console.log('create-analytics-data response:', data);
          analyticsRow = await fetchAnalytics(fid);
        }
      }
      if (analyticsRow) {
        const { fid, updated_at: updatedAt, status, data } = analyticsRow;
        const analyticsData = {
          fid,
          updatedAt,
          status,
          ...(data as object),
        } as unknown as AnalyticsData;
        setAnalyticsData((prev) => ({ ...prev, [fid]: analyticsData }));
      }
    };

    try {
      setIsLoading(true);
      refreshForNewFid(fid);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fid, user]);

  const fetchAndAddUserProfile = async ({ username, fid }: { username?: string; fid: string }) => {
    getUserDataForFidOrUsername({
      username,
      fid,
      viewerFid: process.env.NEXT_PUBLIC_APP_FID!,
    }).then((users) => {
      if (users.length) {
        setSelectedProfile(users[0]);
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    const fidFromQuery = query.fid as string;
    const usernameFromQuery = query.username as string;
    if (fidFromQuery || usernameFromQuery) {
      fetchAndAddUserProfile({
        username: usernameFromQuery,
        fid: fidFromQuery,
      });
    } else if (selectedAccountInApp && selectedAccountInApp?.user) {
      setSelectedProfile(selectedAccountInApp.user);
    } else {
      fetchAndAddUserProfile({
        fid: LANDING_PAGE_DEFAULT_FID,
      });
    }
  }, [query, selectedAccountInApp]);

  const analyticsData = fid ? get(fidToAnalytics, fid) : undefined;

  const renderHeader = () => (
    <div className="flex justify-between items-center">
      <div className="flex self-start space-x-4">
        <ProfileSearchDropdown
          disabled={isLoading || !user}
          defaultProfiles={defaultProfiles}
          selectedProfile={selectedProfile}
          setSelectedProfile={setSelectedProfile}
        />
        {!isLoading && !user && (
          <Link href="/login">
            <Button variant="default">
              See your own Farcaster analytics <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </div>
      <div className="flex flex-col items-end space-y-2">
        <div className="flex items-center space-x-2">
          <ClickToCopyText
            disabled={!analyticsData}
            buttonText="Share"
            size="sm"
            text={`https://app.herocast.xyz/analytics?fid=${fid}`}
          />
          <IntervalFilter
            intervals={intervals}
            defaultInterval={Interval.d7}
            updateInterval={setInterval}
            disabledIntervals={disabledIntervals}
          />
        </div>
        {analyticsData?.updatedAt && (
          <div className="text-sm text-foreground/70">Next update {timeUntilNextUTCHour(4)}</div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return <Loading className="ml-8" loadingMessage={'Loading analytics'} />;
    }
    if (!analyticsData) {
      return <Loading className="ml-8" loadingMessage={'Loading analytics'} />;
    }
    if (analyticsData.status === 'pending') {
      return (
        <Loading
          className="ml-8"
          loadingMessage={'Analytics are being calculated. Please check back in a few minutes.'}
        />
      );
    }
    return (
      <>
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="mr-12"
        >
          <CarouselContent className="">
            <CarouselItem className="md:basis-1/2 lg:basis-1/3">
              {analyticsData?.follows && (
                <NewFollowersCard
                  followerCount={selectedProfile?.follower_count}
                  data={analyticsData.follows}
                  isLoading={isLoading}
                  interval={interval}
                />
              )}
            </CarouselItem>
            <CarouselItem className="md:basis-1/2 lg:basis-1/3">
              {analyticsData?.reactions && (
                <ReactionsCard data={analyticsData.reactions} isLoading={isLoading} interval={interval} />
              )}
            </CarouselItem>
            {!isCustomer && (
              <CarouselItem className="md:basis-1/2 lg:basis-1/3 -mt-2 mb-2 mx-auto text-center">
                <UpgradeFreePlanCard limitKey="analyticsEnabledInterval" />
              </CarouselItem>
            )}
            <CarouselItem className="md:basis-1/2 lg:basis-1/3">
              {analyticsData?.casts && (
                <CastsCard data={analyticsData.casts} isLoading={isLoading} interval={interval} />
              )}
            </CarouselItem>
          </CarouselContent>
          <CarouselNext />
        </Carousel>
        <div className="mt-8">
          <DynamicChartCard analyticsData={analyticsData} isLoading={isLoading} interval={interval} />
        </div>
        <Tabs defaultValue="default">
          <div className="flex items-center mb-4">
            <TabsList>
              <TabsTrigger value="default">Top Casts</TabsTrigger>
              <TabsTrigger value="followers">Top Followers (beta)</TabsTrigger>
              <TabsTrigger value="unfollows">Recent Unfollows</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="default" className="max-w-full">
            <div className="my-4">
              <h2 className="text-2xl font-bold">Top casts</h2>
            </div>
            {analyticsData.topCasts && <CastReactionsTable rawCasts={analyticsData.topCasts} />}
          </TabsContent>
          <TabsContent value="followers" className="max-w-full">
            <div className="my-4">
              <h2 className="text-2xl font-bold">Top followers</h2>
            </div>
            <TopFollowers fid={fid} />
          </TabsContent>
          <TabsContent value="unfollows" className="max-w-full">
            <div className="my-4">
              <h2 className="text-2xl font-bold">Recent Unfollows</h2>
            </div>
            {analyticsData.unfollows && <RecentUnfollows fid={fid} unfollows={analyticsData.unfollows} />}
          </TabsContent>
        </Tabs>
      </>
    );
  };

  return (
    <div className="w-full space-y-8 p-2 md:p-6">
      {renderHeader()}
      {renderContent()}
    </div>
  );
}
