import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from "react";
import AnalyticsGraph from "./AnalyticsGraph";

const NewFollowersCard = ({ data }: { data }) => {
  const { overview = {}, aggregated = [] } = data;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardDescription>Last 7 days</CardDescription>
        <CardTitle className="text-2xl flex justify-between items-center">
          <span>{overview.total?.toLocaleString() ?? "0"} followers</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64">
          <AnalyticsGraph analyticsKey="followers" aggregated={aggregated} />
        </div>
      </CardContent>
    </Card>
  );
};

export default NewFollowersCard;
