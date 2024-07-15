import React, { useCallback, useMemo } from "react";
import { AreaClosed, Bar } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { scaleTime, scaleLinear } from "@visx/scale";
import { extent, max, bisector } from "@visx/vendor/d3-array";
import { GridRows, GridColumns } from "@visx/grid";
import { format, startOfDay } from "date-fns";
import { LinearGradient } from "@visx/gradient";
import { localPoint } from "@visx/event";
import {
  withTooltip,
  Tooltip,
  TooltipWithBounds,
  defaultStyles,
} from "@visx/tooltip";
import { WithTooltipProvidedProps } from "@visx/tooltip/lib/enhancers/withTooltip";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { Skeleton } from "@/components/ui/skeleton";

type TooltipData = {
  date: Date;
  count: number;
};

type AnalyticsGraphProps = WithTooltipProvidedProps<TooltipData> & {
  analyticsKey: string;
  aggregated: { timestamp: string; count: number }[];
  resolution: "hourly" | "weekly";
  isLoading?: boolean;
};

const background = "#1f2937";
const accentColor = "#1f2937";
const accentColorDark = "#1f2937";
const tooltipStyles = {
  ...defaultStyles,
  background,
  border: "1px solid white",
  color: "white",
};

const AnalyticsGraph: React.FC<AnalyticsGraphProps> = ({
  analyticsKey,
  showTooltip,
  hideTooltip,
  tooltipData,
  tooltipTop = 0,
  tooltipLeft = 0,
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

    if (resolution === "weekly") {
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

  const margin = { top: 10, right: 0, bottom: 20, left: 0 };

  if (isLoading || data.length === 0) {
    return (
      <div className="w-full h-64">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  const xScale = useCallback(
    (width: number) =>
      scaleTime({
        range: [margin.left, width - margin.right],
        domain: extent(data, (d) => d.date) as [Date, Date],
      }),
    [data, margin.left, margin.right]
  );

  const yScale = useCallback(
    (height: number) =>
      scaleLinear({
        range: [height - margin.bottom, margin.top],
        domain: [0, max(data, (d) => d.count ?? 0) || 0],
        nice: true,
      }),
    [data, margin.bottom, margin.top]
  );

  const bisectDate = bisector<TooltipData, Date>((d) => d.date).left;

  function handleTooltip(
    event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>,
    xScale: any,
    yScale: any
  ) {
    const { x } = localPoint(event) || { x: 0 };
    const x0 = xScale.invert(x - margin.left);
    const index = bisectDate(data, x0, 1);
    const d0 = data[index - 1];
    const d1 = data[index];
    let d = d0;
    if (d1 && d1.date) {
      d =
        x0.valueOf() - d0.date.valueOf() > d1.date.valueOf() - x0.valueOf()
          ? d1
          : d0;
    }
    showTooltip({
      tooltipData: d,
      tooltipLeft: x,
      tooltipTop: yScale(d.count),
    });
  }

  const renderGraph = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      const xScaleLocal = xScale(width);
      const yScaleLocal = yScale(height);

      return (
        <div className="relative w-full h-full">
          <svg width={width} height={height}>
            <LinearGradient
              id="area-gradient"
              from={accentColor}
              to={accentColor}
              toOpacity={0.1}
            />
            <Group left={margin.left} top={margin.top}>
              <AxisBottom
                top={height - margin.top - margin.bottom}
                scale={xScaleLocal}
                stroke={accentColor}
                tickStroke={accentColor}
                tickLabelProps={() => ({
                  fontSize: 11,
                  textAnchor: "middle",
                  fill: accentColor,
                })}
                numTicks={5}
                tickFormat={(date) =>
                  format(date, resolution === "weekly" ? "MMM d" : "HH:mm")
                }
              />
              <GridRows
                scale={yScaleLocal}
                width={width - margin.left - margin.right}
                strokeDasharray="1,3"
                stroke={accentColor}
                strokeOpacity={0.1}
                pointerEvents="none"
              />
              <GridColumns
                scale={xScaleLocal}
                height={height - margin.top - margin.bottom}
                strokeDasharray="1,3"
                stroke={accentColor}
                strokeOpacity={0.1}
                pointerEvents="none"
              />
              <AreaClosed
                data={data}
                x={(d) => xScaleLocal(d.date) ?? 0}
                y={(d) => yScaleLocal(d.count ?? 0)}
                yScale={yScaleLocal}
                strokeWidth={2}
                stroke={accentColor}
                fill="url(#area-gradient)"
                curve={curveMonotoneX}
              />
              <Bar
                x={0}
                y={0}
                width={width - margin.left - margin.right}
                height={height - margin.top - margin.bottom}
                fill="transparent"
                rx={14}
                onTouchStart={(event) =>
                  handleTooltip(event, xScaleLocal, yScaleLocal)
                }
                onTouchMove={(event) =>
                  handleTooltip(event, xScaleLocal, yScaleLocal)
                }
                onMouseMove={(event) =>
                  handleTooltip(event, xScaleLocal, yScaleLocal)
                }
                onMouseLeave={() => hideTooltip()}
              />
              {tooltipData && tooltipData.date && (
                <g>
                  <circle
                    cx={tooltipLeft}
                    cy={tooltipTop}
                    r={4}
                    fill="black"
                    fillOpacity={0.1}
                    stroke="black"
                    strokeOpacity={0.05}
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                  <circle
                    cx={tooltipLeft - margin.left}
                    cy={tooltipTop - margin.top}
                    r={4}
                    fill={accentColorDark}
                    stroke="white"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                </g>
              )}
            </Group>
          </svg>
          {tooltipData && tooltipData.count !== undefined && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <TooltipWithBounds
                key={`tooltip-${tooltipData.date?.getTime() ?? 'default'}`}
                top={tooltipTop - 12}
                left={tooltipLeft}
                style={tooltipStyles}
              >
                {`${tooltipData.count} ${analyticsKey}`}
              </TooltipWithBounds>
              <Tooltip
                top={height - margin.bottom}
                left={tooltipLeft}
                style={{
                  ...defaultStyles,
                  minWidth: 72,
                  textAlign: "center",
                  transform: "translateX(-50%)",
                }}
              >
                {format(tooltipData.date, resolution === "weekly" ? "MMM d, yyyy" : "MMM d, yyyy HH:mm")}
              </Tooltip>
            </div>
          )}
        </div>
      );
    },
    [
      data,
      xScale,
      yScale,
      margin,
      handleTooltip,
      hideTooltip,
      tooltipData,
      tooltipTop,
      tooltipLeft,
      resolution,
    ]
  );

  return (
    <ParentSize>
      {({ width, height }) => renderGraph({ width, height })}
    </ParentSize>
  );
};

export default withTooltip<AnalyticsGraphProps>(AnalyticsGraph);
