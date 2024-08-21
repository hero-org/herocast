import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AnalyticsGraph from "./AnalyticsGraph";
import { Interval } from "@/common/helpers/search";
import { CombinedActivityData } from "@/common/types/types";
import { formatLargeNumber } from "@/common/helpers/text";
import { subDays } from "date-fns";
import { fillMissingDaysBetweenDates } from "@/common/helpers/analytics";

type ReactionsCardProps = {
  interval: Interval;
  data: CombinedActivityData;
  isLoading: boolean;
};

const ReactionsCard = ({ interval, data, isLoading }: ReactionsCardProps) => {
  const { overview, aggregated = [] } = data;

  const value =
    (overview && overview[interval === Interval.d7 ? "d7" : "d30"]) || 0;

  const startDate = subDays(new Date(), interval === Interval.d7 ? 7 : 30);
  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-stretch space-y-0 border-b border-foreground/20 p-0">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>New reactions</CardTitle>
          <CardDescription>Reactions in the last {interval}</CardDescription>
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
        <div className="pt-6 w-full h-full sm:max-h-52 lg:max-h-70">
          <AnalyticsGraph
            analyticsKey="reactions"
            data={fillMissingDaysBetweenDates(aggregated, startDate, new Date())}
            isLoading={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ReactionsCard;
