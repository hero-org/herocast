"use client";

import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import { Interval } from "@/common/helpers/search";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { roundToNextDigit } from "@/common/helpers/math";

type AnalyticsGraphProps = {
  analyticsKey: string;
  aggregated: { timestamp: string; count: number }[];
  isLoading: boolean;
  interval?: Interval;
};

const AnalyticsGraph: React.FC<AnalyticsGraphProps> = ({ analyticsKey, aggregated, isLoading = false, interval }) => {
  const data = useMemo(() => {
    if (!aggregated) return [];

    let filteredData = aggregated;
    if (interval) {
      const cutoffDate = subDays(new Date(), interval === Interval.d7 ? 7 : 30);
      filteredData = aggregated.filter((item) => new Date(item.timestamp) >= cutoffDate);
    }

    return filteredData.map((item) => ({
      date: item.timestamp,
      [analyticsKey]: item.count,
    }));
  }, [aggregated, interval]);

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
    <ChartContainer config={chartConfig} className="-ml-8 w-full min-w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart accessibilityLayer data={data}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} tickMargin={8} tickFormatter={(date: Date) => format(date, "MMM d")} />
          <YAxis
            interval="preserveStartEnd"
            domain={([dataMin, dataMax]) => [Math.floor(dataMin / 10) * 10, Math.ceil((dataMax + 20) / 10) * 10]}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  return new Date(value).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                }}
              />
            }
            cursor={false}
            defaultIndex={1}
          />
          <Area
            type="monotone"
            dataKey={analyticsKey}
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
