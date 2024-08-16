import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AnalyticsGraph from "./AnalyticsGraph";

const ReactionsCard = ({ data, isLoading }: { data; isLoading }) => {
  const { overview = {}, aggregated = [] } = data || {};
  const { total } = overview;
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardDescription>Last 7 days</CardDescription>
        <CardTitle className="text-2xl flex justify-between items-center">
          <span>{total?.toLocaleString() ?? "0"} reactions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total > 0 && (
          <div className="w-full h-full max-h-70">
            <AnalyticsGraph analyticsKey="reactions" aggregated={aggregated} isLoading={isLoading} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReactionsCard;
