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

export type UnfollowData = {
  target_fid: number;
  deleted_at: string;
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
  unfollows: UnfollowData[];
};

export type AnalyticsKey = 'follows' | 'casts' | 'reactions';

export enum Interval {
  d1 = '1 day',
  d7 = '7 days',
  d14 = '14 days',
  d30 = '30 days',
  d90 = '90 days',
}
