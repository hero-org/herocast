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

const NewFollowersCard: React.FC = ({
  resolution,
}: {
  resolution: "weekly" | "daily";
}) => {
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );
  const { follows } = viewerFid
    ? useDataStore((state) => get(state.fidToAnalytics, viewerFid, {}))
    : {};
  if (isEmpty(follows)) return null;

  const { overview, aggregated } = follows;
  const d7Change = (overview.d7 / (overview.total - overview.d7)) * 100;
  console.log('aggreagted followers', follows)
  return (
    <Card title="New followers">
      <CardHeader>
        <CardTitle className="text-2xl flex">
          {overview.total} followers
        </CardTitle>
        <CardDescription>
          <p className="text-sm font-semibold text-green-500">
            {d7Change.toFixed(2)}%
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64">
          <AnalyticsGraph aggregated={aggregated} resolution={resolution} />
        </div>
      </CardContent>
    </Card>
  );
};

export default NewFollowersCard;
