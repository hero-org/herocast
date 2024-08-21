export const planLimits = {
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

export const openSourcePlanLimits = {
    maxSavedSearches: 1,
    maxAccounts: 2,
    maxScheduledCasts: 3,
}

export type openSourceLimits = 'maxSavedSearches' | 'maxAccounts' | 'maxScheduledCasts';