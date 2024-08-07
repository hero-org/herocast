import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import { useAccountStore } from "@/stores/useAccountStore";
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import React, { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const supabase = useSupabaseClient();
  const [analyticsData, setAnalyticsData] = useState(null);
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx].platformAccountId
  );

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!viewerFid) return;

      const { data, error } = await supabase
        .from('analytics')
        .select('data')
        .eq('fid', viewerFid)
        .single();

      if (error) {
        console.error('Error fetching analytics:', error);
      } else {
        setAnalyticsData(data?.data);
      }
    };

    fetchAnalytics();
  }, [viewerFid, supabase]);

  if (!analyticsData) {
    return <div className="w-full m-8 text-center">Loading analytics...</div>;
  }

  return (
    <div className="w-full m-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {analyticsData.links && (
        <NewFollowersCard resolution="daily" data={analyticsData.links} />
      )}
      {analyticsData.reactions && (
        <ReactionsCard resolution="daily" data={analyticsData.reactions} />
      )}
    </div>
  );
}
