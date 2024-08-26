import { Interval } from '@/common/types/types';

export type PlanType = 'openSource' | 'creator' | 'pro';
export type PlanLimitsKeys = 'maxSavedSearches' | 'maxAccounts' | 'maxScheduledCasts' | 'analyticsEnabledInterval';
export type PlanLimitsType = {
  maxSavedSearches: number;
  maxAccounts: number;
  maxScheduledCasts: number;
  analyticsEnabledInterval: Interval[];
};

const planLimits: Record<PlanType, PlanLimitsType> = {
  openSource: {
    maxSavedSearches: 1,
    maxAccounts: 2,
    maxScheduledCasts: 3,
    analyticsEnabledInterval: [Interval.d7],
  },
  creator: {
    maxSavedSearches: 5,
    maxAccounts: 10,
    maxScheduledCasts: 15,
    analyticsEnabledInterval: [Interval.d7, Interval.d30],
  },
  pro: {
    maxSavedSearches: 10,
    maxAccounts: 20,
    maxScheduledCasts: 30,
    analyticsEnabledInterval: [Interval.d7, Interval.d30, Interval.d90],
  },
};

export const getPlanLimitsForPlan = (plan: PlanType): PlanLimitsType => {
  return planLimits[plan];
};
