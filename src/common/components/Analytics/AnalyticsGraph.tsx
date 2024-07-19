"use client"

import React, { useMemo } from "react";
import { format, startOfDay } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

type AnalyticsGraphProps = {
  analyticsKey: string;
  aggregated: { timestamp: string; count: number }[];
  resolution: "hourly" | "daily";
  isLoading?: boolean;
};

const AnalyticsGraph: React.FC<AnalyticsGraphProps> = ({
  analyticsKey,
  aggregated,
  resolution,
  isLoading = false,
}) => {
  const data = useMemo(() => {
    if (isLoading || aggregated.length === 0) return [];

    const sortedAggregated = [...aggregated].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (resolution === "daily") {
      const groupedByDay = sortedAggregated.reduce((acc, item) => {
        const day = startOfDay(new Date(item.timestamp)).getTime();
        if (!acc[day]) {
          acc[day] = { date: new Date(day), count: 0 };
        }
        acc[day].count += item.count;
        return acc;
      }, {} as Record<number, { date: Date; count: number }>);

      return Object.values(groupedByDay);
    }

    return sortedAggregated.map((item) => ({
      date: new Date(item.timestamp),
      count: item.count,
    }));
  }, [aggregated, resolution, isLoading]);

  if (isLoading || data.length === 0) {
    return (
      <div className="w-full h-[200px]">
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
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(new Date(date), resolution === "daily" ? "MMM d" : "HH:mm")}
          />
          <YAxis />
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          {chartConfig[analyticsKey].label}
                        </span>
                        <span className="font-bold text-muted-foreground">
                          {payload[0].value}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--chart-1))"
            fillOpacity={1}
            fill="url(#colorCount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default AnalyticsGraph;
