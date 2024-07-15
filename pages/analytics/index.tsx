import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import { Analytics, AnalyticsKey } from "@/common/types/types";
import { Card } from "@/components/ui/card";
import { useAccountStore } from "@/stores/useAccountStore";
import { useDataStore } from "@/stores/useDataStore";
import { useQuery } from "@tanstack/react-query";
import isEmpty from "lodash.isempty";
import React, { useEffect } from "react";

const getAnalyticsForUser = async (
  analyticsKey: AnalyticsKey,
  fid: number
): Promise<Analytics & { fid: number }> => {
  const response = await fetch(`/api/analytics/${analyticsKey}?fid=${fid}`);
  const data = await response.json();
  console.log("getAnalyticsForUser", fid);
  return data;
};

export default function AnalyticsPage() {
  const { addAnalytics } = useDataStore();
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );
  const { data: analyticsFollowData } = useQuery({
    queryKey: ["analytics", "follows", viewerFid],
    queryFn: () => getAnalyticsForUser("follows", Number(viewerFid!)),
    enabled: !!viewerFid,
  });
  const { data: analyticsReactionsData } = useQuery({
    queryKey: ["analytics", "reactions", viewerFid],
    queryFn: () => getAnalyticsForUser("reactions", Number(viewerFid!)),
    enabled: !!viewerFid,
  });

  useEffect(() => {
    if (isEmpty(analyticsFollowData)) return;

    addAnalytics(Number(viewerFid!), analyticsFollowData!);
  }, [analyticsFollowData]);

  useEffect(() => {
    if (isEmpty(analyticsReactionsData)) return;

    addAnalytics(Number(viewerFid!), analyticsReactionsData!);
  }, [analyticsReactionsData]);

  const renderCard = (title: string, children: React.ReactElement) => {
    return (
      <div className="">
        {/* <h2 className="text-lg font-semibold">{title}</h2> */}
        {children}
      </div>
    );
  };
  return (
    <div className="w-full m-8 grid grid-cols-2 gap-4">
      {renderCard("New followers", <NewFollowersCard resolution="weekly" />)}
      {renderCard("Reactions", <ReactionsCard resolution="weekly" />)}
    </div>
  );
}
