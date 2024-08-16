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
  followerCount: number;
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

    return filtered.reduceRight(
      (acc, curr, i, arr) => {
        const count =
          followerCount -
          arr.slice(i + 1).reduce((sum, item) => sum + item.count, 0);
        return [{ ...curr, count }, ...acc];
      },
      [] as CombinedActivityData["aggregated"]
    );
  }, [aggregated, interval]);
  const value = overview[interval === Interval.d7 ? "d7" : "d30"] || 0;
  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>New Followers</CardTitle>
          <CardDescription>Followers in the last {interval}</CardDescription>
        </div>
        <div className="flex">
          <div className="relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground">{interval}</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {formatLargeNumber(value)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {value > 0 && (
          <div className="pt-6 w-full h-full max-h-70">
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
