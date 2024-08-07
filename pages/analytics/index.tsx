import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import CastReactionsTable from "@/common/components/Analytics/CastReactionsTable";
import { createClient } from "@/common/helpers/supabase/component";
import { AnalyticsData } from "@/common/types/types";
import { useAccountStore } from "@/stores/useAccountStore";
import React, { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const supabaseClient = createClient();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>();
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
      if (analyticsRow && analyticsRow.status === "done") {
        const { fid, updated_at: updatedAt, data } = analyticsRow;
        const analyticsData = {
          fid,
          updatedAt,
          ...data,
        } as unknown as AnalyticsData;
        setAnalyticsData(analyticsData);
      }
    };

    fetchAnalytics();
  }, [viewerFid]);

  if (!analyticsData) {
    return <div className="w-full m-8 text-center">Loading analytics...</div>;
  }

  console.log("analyticsData", analyticsData);
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
      {analyticsData.casts && (
        <CastReactionsTable rawCasts={analyticsData.casts} />
      )}
    </div>
  );
}
