'use client';

import { format } from 'date-fns';
import type React from 'react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

type AnalyticsGraphProps = {
  analyticsKey: string;
  data: { timestamp: string; count: number }[];
  isLoading: boolean;
};

const AnalyticsGraph: React.FC<AnalyticsGraphProps> = ({ analyticsKey, data, isLoading = false }) => {
  const chartData = useMemo(() => {
    if (!data) return [];

    return data.map((item) => ({
      date: item.timestamp,
      [analyticsKey]: item.count,
    }));
  }, [data]);

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
      color: 'hsl(var(--chart-1))',
    },
  };

  return (
    <ChartContainer config={chartConfig} className="-ml-8 w-full min-w-full h-full sm:max-h-52 lg:max-h-70">
      {/* <ResponsiveContainer width="100%" height="100%"> */}
      <AreaChart accessibilityLayer data={chartData}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="25%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} tickMargin={8} tickFormatter={(date: Date) => format(date, 'MMM d')} />
        <YAxis
          tickCount={7}
          domain={([dataMin, dataMax]) => [Math.floor(dataMin / 100) * 100, Math.ceil(((dataMax + 5) / 10) * 10)]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                return new Date(value).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
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
      {/* </ResponsiveContainer> */}
    </ChartContainer>
  );
};

export default AnalyticsGraph;
