import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React, { useMemo } from "react";
import AnalyticsGraph from "./AnalyticsGraph";
import { CombinedActivityData } from "@/common/types/types";
import { Interval } from "@/common/helpers/search";
import { formatLargeNumber } from "@/common/helpers/text";
import { subDays } from "date-fns";

type StatsWithGraphCard = {
  followerCount: number | undefined;
  interval: Interval;
  data: CombinedActivityData;
  isLoading: boolean;
};

const NewFollowersCard = ({
  followerCount,
  interval,
  data,
  isLoading,
}: StatsWithGraphCard) => {
  const { overview, aggregated = [] } = data;

  const cumulativeAggregated = useMemo(() => {
    const startDate = subDays(new Date(), interval === Interval.d7 ? 7 : 30);
    const filtered = aggregated.filter(
      (item) => new Date(item.timestamp) >= startDate
    );

    const calculateCount = (
      arr: typeof aggregated,
      i: number,
      baseCount: number
    ) => {
      const count = arr.slice(i + 1).reduce((sum, item) => sum + item.count, 0);
      return baseCount ? baseCount - count : count;
    };

    if (!followerCount) {
      return filtered.reduce((acc, curr, i, arr) => {
        return [{ ...curr, count: calculateCount(arr, i, 0) }, ...acc];
      }, [] as CombinedActivityData["aggregated"]);
    }
    return filtered.reduceRight((acc, curr, i, arr) => {
      return [
        { ...curr, count: calculateCount(arr, i, followerCount) },
        ...acc,
      ];
    }, [] as CombinedActivityData["aggregated"]);
  }, [aggregated, interval]);
  const value = overview[interval === Interval.d7 ? "d7" : "d30"] || 0;
  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-stretch space-y-0 border-b border-foreground/20 p-0">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>New Followers</CardTitle>
          <CardDescription>Followers in the last {interval}</CardDescription>
        </div>
        <div className="flex">
          <div className="relative flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 border-foreground/20 sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground">{interval}</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {formatLargeNumber(value)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {value > 0 && (
          <div className="pt-6 w-full h-full sm:max-h-52 lg:max-h-70">
            <AnalyticsGraph
              interval={interval}
              analyticsKey="followers"
              aggregated={cumulativeAggregated}
              isLoading={isLoading}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NewFollowersCard;
