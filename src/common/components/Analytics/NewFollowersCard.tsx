import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountStore } from "@/stores/useAccountStore";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";
import isEmpty from "lodash.isempty";
import React from "react";
import AnalyticsGraph from "./AnalyticsGraph";

const NewFollowersCard = ({
  resolution,
}: {
  resolution: "hourly" | "daily";
}) => {
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );
  const analytics = viewerFid
    ? useDataStore((state) => get(state.fidToAnalytics, viewerFid, {}))
    : {};
  const { overview = {}, aggregated = [] } = analytics?.follows || {};
  const d7Change = (overview.d7 / (overview.total - overview.d7)) * 100;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardDescription>Last 7 days</CardDescription>
        <CardTitle className="text-2xl flex justify-between items-center">
          <span>{overview.total?.toLocaleString() ?? "0"} followers</span>
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
            analyticsKey="followers"
            aggregated={aggregated}
            resolution={resolution}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default NewFollowersCard;
