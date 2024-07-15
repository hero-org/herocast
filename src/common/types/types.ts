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

export type Analytics = {
    fid?: number
    updatedAt: number;
    follows: {
        overview: OverviewAnalytics,
        aggregated: AggregatedAnalytics[]
    },
    casts: {
        overview: OverviewAnalytics,
        aggregated: AggregatedAnalytics[]
    },
    reactions: {
        overview: OverviewAnalytics,
        aggregated: AggregatedAnalytics[]
    }
};

export type AnalyticsKey = 'follows' | 'casts' | 'reactions';
