"use client";

import React, { useMemo } from "react";
import { format, startOfDay } from "date-fns";
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
  isLoading?: boolean;
};

const AnalyticsGraph: React.FC<AnalyticsGraphProps> = ({
  analyticsKey,
  aggregated,
  isLoading = false,
}) => {
  const data = useMemo(() => {
    if (isLoading || aggregated.length === 0) return [];

    const sortedAggregated = [...aggregated].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return sortedAggregated.map((item) => ({
      date: new Date(item.timestamp),
      count: item.count,
    }));
  }, [aggregated, isLoading]);

  if (isLoading || data.length === 0) {
    return (
      <div className="w-full h-[180px]">
        <Skeleton className="w-full h-full" />
      </div>
    );
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
            tickFormatter={(date) => format(new Date(date), "MMM d")}
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
