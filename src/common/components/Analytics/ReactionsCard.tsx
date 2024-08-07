import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AnalyticsGraph from "./AnalyticsGraph";

const ReactionsCard = ({ data }: { data }) => {
  const { overview = {}, aggregated = [] } = data || {};

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardDescription>Last 7 days</CardDescription>
        <CardTitle className="text-2xl flex justify-between items-center">
          <span>{overview.total?.toLocaleString() ?? "0"} reactions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64">
          <AnalyticsGraph analyticsKey="reactions" aggregated={aggregated} />
        </div>
      </CardContent>
    </Card>
  );
};

export default ReactionsCard;
