import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import { useAccountStore } from "@/stores/useAccountStore";
import { Analytics, useDataStore } from "@/stores/useDataStore";
import { useQuery } from "@tanstack/react-query";
import isEmpty from "lodash.isempty";
import React, { useEffect } from "react";

const getAnalyticsForUser = async (
  fid: number
): Promise<Analytics & { fid: number }> => {
  const response = await fetch(`/api/analytics?fid=${fid}`);
  const data = await response.json();
  console.log("getAnalyticsForUser", fid);
  return data;
};

export default function AnalyticsPage() {
  const { addAnalytics } = useDataStore();
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );
  const { data: analyticsData } = useQuery({
    queryKey: ["analytics", viewerFid],
    queryFn: () => getAnalyticsForUser(Number(viewerFid!)),
    enabled: !!viewerFid,
  });

  useEffect(() => {
    if (isEmpty(analyticsData)) return;

    addAnalytics(Number(viewerFid!), analyticsData!);
  }, [analyticsData]);

  const renderCard = (title: string, CardComponent: React.FC) => {
    return (
      <div className="">
        {/* <h2 className="text-lg font-semibold">{title}</h2> */}
        <CardComponent />
      </div>
    );
  };
  return (
    <div className="m-8">
      <div className="grid grid-cols-2 gap-4">
        {renderCard("New followers", NewFollowersCard)}
        {renderCard("Reactions", ReactionsCard)}
      </div>
    </div>
  );
}
