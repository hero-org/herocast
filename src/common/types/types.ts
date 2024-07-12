export type FollowAnalytics = {
    timestamp: number;
    count: number;
};

export type CastAnalytics = {
    timestamp: number;
    count: number;
};

export type ReactionsAnalytics = {
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
        aggregated: FollowAnalytics[]
    },
    casts: {
        overview: OverviewAnalytics,
        aggregated: CastAnalytics[]
    },
    reactions: {
        overview: OverviewAnalytics,
        aggregated: ReactionsAnalytics[]
    }
};