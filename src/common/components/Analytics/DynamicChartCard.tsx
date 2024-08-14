import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AnalyticsGraph from "./AnalyticsGraph";
import { AnalyticsData, CombinedActivityData } from "@/common/types/types";
import { formatLargeNumber } from "@/common/helpers/text";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

type DynamicChartCardProps = {
  interval: Interval;
  analyticsData: AnalyticsData;
  isLoading: boolean;
};

function DataPickerDropdown({ values, defaultValue, updateValue }) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<Interval | undefined>(defaultValue);

  const canSelect = updateValue !== undefined;
  const handleSelect = (currentValue: Interval) => {
    setValue(currentValue === value ? undefined : currentValue);
    updateValue?.(currentValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          disabled={!canSelect}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[110px] justify-between"
        >
          {value !== undefined
            ? values.find((interval) => interval === value)
            : "Interval..."}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {values.map((interval) => (
                <CommandItem
                  key={interval}
                  value={interval.toString()}
                  onSelect={(value) =>
                    handleSelect(value as unknown as Interval)
                  }
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === interval ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {interval}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const values = ["casts", "follows", "reactions"];

const getAggregatedDataForKey = (
  analyticsData: AnalyticsData,
  dataKey: string,
  cutoffDate: Date
) => {
  const data = analyticsData[dataKey].aggregated;
  console.log('getAggregatedDataForKey', dataKey, data)
  const res = data.map((item) => ({
    date: item.timestamp,
    [dataKey]: item.count,
  }));
  return res.filter((item) => new Date(item.date) >= cutoffDate);
};

const DynamicChartCard = ({
  interval,
  analyticsData,
  isLoading,
}: DynamicChartCardProps) => {
  const [dataKey1, setDataKey1] = React.useState(values[0]);
  const [dataKey2, setDataKey2] = React.useState(values[1]);

  const chartConfig = React.useMemo(() => {
    const config = {};
    values.forEach((value, index) => {
      config[value] = {
        label: value,
        color: `hsl(var(--chart-${index + 1}))`,
      };
    });
    return config;
  }, [values]);

  const data = useMemo(() => {
    if (!analyticsData) return [];

    const cutoffDate = subDays(new Date(), interval === Interval.d7 ? 7 : 30);

    const data1 = getAggregatedDataForKey(analyticsData, dataKey1, cutoffDate);
    const data2 = getAggregatedDataForKey(analyticsData, dataKey2, cutoffDate);
    if (!data1 || !data2) return [];
    const mergeData = (data1, data2) => {
      const merged = {};

      data1.forEach((item) => {
        if (!merged[item.date]) {
          merged[item.date] = { date: item.date, [dataKey1]: item[dataKey1] };
        } else {
          merged[item.date][dataKey1] = item[dataKey1];
        }
      });

      data2.forEach((item) => {
        if (!merged[item.date]) {
          merged[item.date] = { date: item.date, [dataKey2]: item[dataKey2] };
        } else {
          merged[item.date][dataKey2] = item[dataKey2];
        }
      });

      return Object.values(merged);
    };

    return mergeData(data1, data2);
  }, [analyticsData, interval, dataKey1, dataKey2]);

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>
            Compare {dataKey1} with {dataKey2}
          </CardTitle>
          <CardDescription> in the last {interval}</CardDescription>
        </div>
        <div className="flex">
          <div className="relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <span className="text-lg font-bold leading-none sm:text-3xl">
              <DataPickerDropdown
                values={values}
                defaultValue={values[0]}
                updateValue={setDataKey1}
              />
            </span>
          </div>
          <div className="relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <DataPickerDropdown
              values={values}
              defaultValue={values[1]}
              updateValue={setDataKey2}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="pt-6 w-full h-full max-h-70">
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
                  dataKey={dataKey1}
                  stroke="hsl(var(--muted-foreground))"
                  fillOpacity={5}
                  fill="url(#colorCount)"
                  stackId="a"
                />
                <Area
                  type="monotone"
                  dataKey={dataKey2}
                  stroke="hsl(var(--muted-foreground))"
                  fillOpacity={5}
                  fill="url(#colorCount)"
                  stackId="b"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default DynamicChartCard;
