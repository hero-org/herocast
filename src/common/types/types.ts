export type AggregatedAnalytics = {
  timestamp: string;
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

export type CombinedActivityData = {
  overview: OverviewAnalytics;
  aggregated: AggregatedAnalytics[];
};

export type AnalyticsData = {
  fid?: number;
  updatedAt: number;
  status: string;
  follows: CombinedActivityData;
  reactions: CombinedActivityData;
  casts: CombinedActivityData;
  topCasts: CastData[];
};

export type AnalyticsKey = 'follows' | 'casts' | 'reactions';
