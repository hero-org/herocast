import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from "react";
import AnalyticsGraph from "./AnalyticsGraph";

const NewFollowersCard = ({ data, isLoading }: { data; isLoading }) => {
  const { overview = {}, aggregated = [] } = data;
  const { total } = overview;
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardDescription>Last 7 days</CardDescription>
        <CardTitle className="text-2xl flex justify-between items-center">
          <span>{total?.toLocaleString() ?? "0"} followers</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total > 0 && (
          <div className="w-full h-full max-h-64">
            <AnalyticsGraph
              analyticsKey="followers"
              aggregated={aggregated}
              isLoading={isLoading}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NewFollowersCard;
