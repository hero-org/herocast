import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import CastReactionsTable from "@/common/components/Analytics/CastReactionsTable";
import { createClient } from "@/common/helpers/supabase/component";
import { AnalyticsData } from "@/common/types/types";
import { useAccountStore } from "@/stores/useAccountStore";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import get from "lodash.get";
import { Loading } from "@/common/components/Loading";
import { ProfileSearchDropdown } from "@/common/components/ProfileSearchDropdown";
import { getUserDataForFidOrUsername } from "@/common/helpers/neynar";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useAuth } from "@/common/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ChartBarIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import ClickToCopyText from "@/common/components/ClickToCopyText";
import { Interval } from "@/common/helpers/search";
import { IntervalFilter } from "@/common/components/IntervalFilter";
import DynamicChartCard from "@/common/components/Analytics/DynamicChartCard";
import { addDays, formatDistanceToNow, isBefore } from "date-fns";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import CastsCard from "@/common/components/Analytics/CastsCard";

type FidToAnalyticsData = Record<string, AnalyticsData>;
const intervals = [Interval.d7, Interval.d30];

function timeUntilNextUTCHour(hour: number): string {
  const now = new Date();

  // Create a Date object for 4:00 AM UTC today
  let next4amUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      0,
      0
    )
  );

  // If the current time is already past 4:00 AM UTC, move to the next day
  if (isBefore(next4amUTC, now)) {
    next4amUTC = addDays(next4amUTC, 1);
  }

  // Calculate the time until next 4:00 AM UTC
  const timeRemaining = formatDistanceToNow(next4amUTC, { addSuffix: true });

  return timeRemaining;
}
export default function AnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { query } = router;
  const supabaseClient = createClient();

  const [interval, setInterval] = useState<Interval>(intervals[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [fidToAnalytics, setAnalyticsData] = useState<FidToAnalyticsData>({});
  const selectedAccountInApp = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const { accounts } = useAccountStore();

  const defaultProfiles = useMemo(() => {
    return accounts
      .filter((account) => account.status === "active")
      .map((a) => a.user) as User[];
  }, [accounts]);

  const [selectedProfile, setSelectedProfile] = useState<User>();
  const fid = get(selectedProfile, "fid")?.toString();

  useEffect(() => {
    if (!fid) return;

    const fetchAnalytics = async (fid: string) => {
      const { data: analyticsRow, error } = await supabaseClient
        .from("analytics")
        .select("*")
        .eq("fid", fid)
        .maybeSingle();
      if (error) {
        console.error("Error fetching analytics:", error);
        return false;
      }
      return analyticsRow;
    };
    const refreshForNewFid = async (fid: string) => {
      if (!fid) return;

      let analyticsRow = await fetchAnalytics(fid);
      if (!analyticsRow && user) {
        console.error("No analytics found for fid:", fid);
        const { data, error } = await supabaseClient.functions.invoke(
          "create-analytics-data",
          {
            body: JSON.stringify({ fid }),
          }
        );
        if (error) {
          console.error("Error invoking create-analytics-data:", error);
        } else {
          console.log("create-analytics-data response:", data);
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
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fid, user]);

  useEffect(() => {
    const fidFromQuery = query.fid as string;
    const usernameFromQuery = query.username as string;
    if (fidFromQuery || usernameFromQuery) {
      getUserDataForFidOrUsername({
        username: usernameFromQuery,
        fid: fidFromQuery,
        viewerFid: process.env.NEXT_PUBLIC_APP_FID!,
      }).then((users) => {
        if (users.length) {
          setSelectedProfile(users[0]);
        }
        setIsLoading(false);
      });
    } else if (selectedAccountInApp && selectedAccountInApp?.user) {
      setSelectedProfile(selectedAccountInApp.user);
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
            <Button variant="default" size="sm">
              Login to see more insights{" "}
              <ChartBarIcon className="h-4 w-4 ml-2" />
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
          />
        </div>
        {analyticsData?.updatedAt && (
          <div className="text-sm text-foreground/70">
            Next update {timeUntilNextUTCHour(4)}
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return <Loading className="ml-8" loadingMessage={"Loading analytics"} />;
    }
    if (!analyticsData) {
      return <Loading className="ml-8" loadingMessage={"Loading analytics"} />;
    }
    if (analyticsData.status === "pending") {
      return (
        <Loading
          className="ml-8"
          loadingMessage={
            "Analytics are being calculated. Please check back in a few minutes."
          }
        />
      );
    }
    return (
      <>
        <Carousel
          opts={{
            align: "start",
          }}
          className="md:mx-8 lg:mx-0"
        >
          <CarouselContent className="">
            {" "}
            <CarouselItem className="md:basis-1/2 lg:basis-1/3">
              {analyticsData?.follows && (
                <NewFollowersCard
                  // followerCount={selectedProfile?.follower_count}
                  data={analyticsData.follows}
                  isLoading={isLoading}
                  interval={interval}
                />
              )}
            </CarouselItem>
            <CarouselItem className="md:basis-1/2 lg:basis-1/3">
              {analyticsData?.reactions && (
                <ReactionsCard
                  data={analyticsData.reactions}
                  isLoading={isLoading}
                  interval={interval}
                />
              )}
            </CarouselItem>
            <CarouselItem className="md:basis-1/2 lg:basis-1/3">
              {analyticsData?.casts && (
                <CastsCard
                  data={analyticsData.casts}
                  isLoading={isLoading}
                  interval={interval}
                />
              )}
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
        <div className="mt-8">
          <DynamicChartCard
            analyticsData={analyticsData}
            isLoading={isLoading}
            interval={interval}
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Top casts</h2>
        </div>
        {analyticsData.topCasts && (
          <CastReactionsTable rawCasts={analyticsData.topCasts} />
        )}
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
