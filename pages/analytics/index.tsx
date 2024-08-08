import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import CastReactionsTable from "@/common/components/Analytics/CastReactionsTable";
import { createClient } from "@/common/helpers/supabase/component";
import { AnalyticsData } from "@/common/types/types";
import { useAccountStore } from "@/stores/useAccountStore";
import React, { useEffect, useState } from "react";
import get from "lodash.get";
import { Loading } from "@/common/components/Loading";
import { AccountSelector } from "@/common/components/AccountSelector";

type FidToAnalyticsData = Record<string, AnalyticsData>;

export default function AnalyticsPage() {
  const supabaseClient = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [fidToAnalytics, setAnalyticsData] = useState<FidToAnalyticsData>({});
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );

  useEffect(() => {
    const fetchAnalytics = async (viewerFid) => {
      const { data: analyticsRow, error } = await supabaseClient
        .from("analytics")
        .select("*")
        .eq("fid", viewerFid)
        .maybeSingle();
      if (error) {
        console.error("Error fetching analytics:", error);
        return false;
      }
      return analyticsRow;
    };
    const refreshForNewFid = async () => {
      if (!viewerFid) return;

      let analyticsRow = await fetchAnalytics(viewerFid);
      if (!analyticsRow) {
        console.error("No analytics found for viewerFid:", viewerFid);
        const { data, error } = await supabaseClient.functions.invoke(
          "create-analytics-data",
          {
            body: JSON.stringify({ fid: viewerFid }),
          }
        );
        if (error) {
          console.error("Error invoking create-analytics-data:", error);
        } else {
          console.log("create-analytics-data response:", data);
          analyticsRow = await fetchAnalytics(viewerFid);
        }
      }
      if (analyticsRow) {
        const { fid, updated_at: updatedAt, status, data } = analyticsRow;
        const analyticsData = {
          fid,
          updatedAt,
          status,
          ...(data as object),
        } as unknown as AnalyticsData;
        setAnalyticsData((prev) => ({ ...prev, [fid]: analyticsData }));
      }
    };

    try {
      setIsLoading(true);
      refreshForNewFid();
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [viewerFid]);

  if (isLoading) {
    return <Loading className="ml-8" loadingMessage={"Loading analytics"} />;
  }

  const analyticsData = viewerFid ? get(fidToAnalytics, viewerFid) : undefined;
  if (!analyticsData) {
    return <Loading className="ml-8" loadingMessage={"Loading analytics"} />;
  }

  if (analyticsData.status === "pending") {
    return (
      <Loading
        className="ml-8"
        loadingMessage={
          "Analytics are being calculated. Please check back in a few minutes."
        }
      />
    );
  }

  return (
    <div className="w-full m-8 space-y-8">
      <div className="flex items-center justify-between">
        <AccountSelector
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analyticsData?.follows && (
          <NewFollowersCard data={analyticsData.follows} isLoading />
        )}
        {analyticsData?.reactions && (
          <ReactionsCard data={analyticsData.reactions} isLoading />
        )}
      </div>
      <div>
        <h2 className="text-2xl font-bold">Top casts</h2>
      </div>
      {analyticsData.casts && (
        <CastReactionsTable rawCasts={analyticsData.casts} />
      )}
    </div>
  );
}
