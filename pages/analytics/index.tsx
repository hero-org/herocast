import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import CastReactionsTable from "@/common/components/Analytics/CastReactionsTable";
import { createClient } from "@/common/helpers/supabase/component";
import { AnalyticsData } from "@/common/types/types";
import { useAccountStore } from "@/stores/useAccountStore";
import React, { useEffect, useState } from "react";
import get from "lodash.get";

type FidToAnalyticsData = Record<string, AnalyticsData>;

export default function AnalyticsPage() {
  const supabaseClient = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [fidToAnalytics, setAnalyticsData] = useState<FidToAnalyticsData>({});
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!viewerFid) return;

      const { data: analyticsRow, error } = await supabaseClient
        .from("analytics")
        .select("*")
        .eq("fid", viewerFid)
        .maybeSingle();
      if (error) {
        console.error("Error fetching analytics:", error);
        return;
      }

      if (!analyticsRow) {
        console.error("No analytics found for viewerFid:", viewerFid);
        // trigger new fetch
        const { data, error } = await supabaseClient.functions.invoke(
          "create-analytics-data",
          {
            headers: { "Content-Type": "application/json" },
            method: "POST",
            body: { fid: viewerFid },
          }
        );
        console.log("invoke create-analytics-data", { data, error });
      } else {
        const { fid, updated_at: updatedAt, status, data } = analyticsRow;
        const analyticsData = {
          fid,
          updatedAt,
          status,
          ...data,
        } as unknown as AnalyticsData;
        setAnalyticsData((prev) => ({ ...prev, [fid]: analyticsData }));
      }
    };

    try {
      setIsLoading(true);
      fetchAnalytics();
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [viewerFid]);

  if (isLoading) {
    return <div className="w-full m-8 text-center">Loading analytics...</div>;
  }
  const analyticsData = get(fidToAnalytics, viewerFid);
  if (!analyticsData) {
    return <div className="w-full m-8 text-center">Loading analytics...</div>;
  }

  if (analyticsData.status === "pending") {
    return (
      <div className="w-full m-8 text-center">
        Analytics are being calculated. Please check back in a few minutes.
      </div>
    );
  }

  return (
    <div className="w-full m-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analyticsData?.follows && (
          <NewFollowersCard data={analyticsData.follows} />
        )}
        {analyticsData?.reactions && (
          <ReactionsCard data={analyticsData.reactions} />
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
