"use client";

import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import { Interval } from "@/common/helpers/search";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

type AnalyticsGraphProps = {
  analyticsKey: string;
  aggregated: { timestamp: string; count: number }[];
  isLoading: boolean;
  interval?: Interval;
};

const AnalyticsGraph: React.FC<AnalyticsGraphProps> = ({
  analyticsKey,
  aggregated,
  isLoading = false,
  interval,
}) => {
  const data = useMemo(() => {
    if (!aggregated) return [];

    const sortedAggregated = [...aggregated].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let filteredData = sortedAggregated;
    if (interval) {
      const cutoffDate = subDays(new Date(), interval === Interval.d7 ? 7 : 30);
      filteredData = sortedAggregated.filter(
        (item) => new Date(item.timestamp) >= cutoffDate
      );
    }

    return filteredData.map((item) => ({
      date: new Date(item.timestamp),
      count: item.count,
    }));
  }, [aggregated, interval]);

  console.log('data',data)

  if (data.length === 0) {
    if (isLoading) {
      return (
        <div className="w-full h-[180px]">
          <Skeleton className="w-full h-full" />
        </div>
      );
    } else {
      return null;
    }
  }

  const chartConfig = {
    [analyticsKey]: {
      label: analyticsKey,
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <ChartContainer
      config={chartConfig}
      className="-ml-8 w-full min-w-full h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart accessibilityLayer data={data}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={8}
            tickFormatter={(date: Date) => format(date, "MMM d")}
          />
          <YAxis />
          <ChartTooltip
            content={
              <ChartTooltipContent labelKey={chartConfig[analyticsKey].label} />
            }
            cursor={false}
            defaultIndex={1}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--muted-foreground))"
            fillOpacity={5}
            fill="url(#colorCount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default AnalyticsGraph;
