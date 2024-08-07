import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import CastReactionsTable from "@/common/components/Analytics/CastReactionsTable";
import { createClient } from "@/common/helpers/supabase/component";
import { AnalyticsData } from "@/common/types/types";
import { useAccountStore } from "@/stores/useAccountStore";
import React, { useEffect, useState } from "react";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

export default function AnalyticsPage() {
  const supabaseClient = createClient();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>();
  const [castsData, setCastsData] = useState<any[]>([]);
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
          links: data?.links,
          reactions: data?.reactions,
          casts: data?.casts,
        } as unknown as AnalyticsData;
        setAnalyticsData(analyticsData);

        if (data?.casts && data.casts.length > 0) {
          const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
          const hashes = data.casts.map((cast: any) => cast.hash);
          const castsResponse = await neynarClient.fetchBulkCasts(hashes);
          if (castsResponse.casts) {
            const enrichedCasts = data.casts.map((cast: any) => {
              const fullCastData = castsResponse.casts.find((c: any) => c.hash === cast.hash);
              return {
                ...cast,
                text: fullCastData?.text,
                author: fullCastData?.author,
              };
            });
            setCastsData(enrichedCasts);
          }
        }
      }
    };

    fetchAnalytics();
  }, [viewerFid]);

  if (!analyticsData) {
    return <div className="w-full m-8 text-center">Loading analytics...</div>;
  }

  return (
    <div className="w-full m-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analyticsData?.links && (
          <NewFollowersCard data={analyticsData.links} />
        )}
        {analyticsData?.reactions && (
          <ReactionsCard data={analyticsData?.reactions} />
        )}
      </div>
      <CastReactionsTable data={castsData} />
    </div>
  );
}
