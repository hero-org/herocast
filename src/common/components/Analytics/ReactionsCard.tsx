import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountStore } from "@/stores/useAccountStore";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import isEmpty from "lodash.isempty";
import AnalyticsGraph from "./AnalyticsGraph";

type ReactionsCardProps = {
  resolution: "hourly" | "daily";
};

const ReactionsCard: React.FC<ReactionsCardProps> = ({
  resolution = "daily",
}) => {
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );
  const analytics = viewerFid
    ? useDataStore((state) => get(state.fidToAnalytics, viewerFid, {}))
    : {};
  const { overview = {}, aggregated = [] } = analytics?.reactions || {};
  const d7Change =
    overview.d7 && overview.total && overview.total > overview.d7
      ? (overview.d7 / (overview.total - overview.d7) - 1) * 100
      : 0;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardDescription>Last 7 days</CardDescription>
        <CardTitle className="text-2xl flex justify-between items-center">
          <span>{overview.total?.toLocaleString() ?? "0"} reactions</span>
          <span
            className={`text-sm font-semibold ${
              d7Change >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {d7Change >= 0 ? "+" : "-"}
            {Math.abs(d7Change).toFixed(2)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64">
          <AnalyticsGraph
            analyticsKey="reactions"
            aggregated={aggregated}
            resolution={resolution}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ReactionsCard;
