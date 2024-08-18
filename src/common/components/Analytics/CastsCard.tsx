import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from "react";
import AnalyticsGraph from "./AnalyticsGraph";
import { CombinedActivityData } from "@/common/types/types";
import { Interval } from "@/common/helpers/search";
import { formatLargeNumber } from "@/common/helpers/text";

type StatsWithGraphCard = {
  interval: Interval;
  data: CombinedActivityData;
  isLoading: boolean;
};

const CastsCard = ({ interval, data, isLoading }: StatsWithGraphCard) => {
  const { overview, aggregated = [] } = data;
  const value =
    (overview && overview[interval === Interval.d7 ? "d7" : "d30"]) || 0;

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>New casts</CardTitle>
          <CardDescription>Casts in the last {interval}</CardDescription>
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
              analyticsKey="casts"
              aggregated={aggregated}
              isLoading={isLoading}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CastsCard;
