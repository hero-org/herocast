export type AggregatedAnalytics = {
  timestamp: number;
  count: number;
};

type OverviewAnalytics = {
  total: number;
  h24: number;
  d7: number;
  d30: number;
};

export type CastData = {
  hash: string;
  timestamp: string;
  is_reply: boolean;
  like_count: string;
  recast_count: string;
};

export type AnalyticsData = {
  fid?: number;
  updatedAt: number;
  status: string;
  follows: {
    overview: OverviewAnalytics;
    aggregated: AggregatedAnalytics[];
  };
  reactions: {
    overview: OverviewAnalytics;
    aggregated: AggregatedAnalytics[];
  };
  casts: CastData[];
};

export type AnalyticsKey = "follows" | "casts" | "reactions";
