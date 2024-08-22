export type PlanType = 'openSource' | 'creator' | 'pro';
export type PlanLimitsKeys = 'maxSavedSearches' | 'maxAccounts' | 'maxScheduledCasts';
export type PlanLimitsType = {
    [key in PlanLimitsKeys]: number;
}

const planLimits: Record<PlanType, PlanLimitsType> = {
    openSource: {
        maxSavedSearches: 1,
        maxAccounts: 2,
        maxScheduledCasts: 3,
    },
    creator: {
        maxSavedSearches: 5,
        maxAccounts: 10,
        maxScheduledCasts: 15,
    },
    pro: {
        maxSavedSearches: 10,
        maxAccounts: 20,
        maxScheduledCasts: 30,
    },
}


export const getPlanLimitsForUser = (plan: PlanType): PlanLimitsType => {
    return planLimits[plan];
}

