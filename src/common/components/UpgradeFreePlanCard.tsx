import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlanLimitsForPlan, type PlanLimitsKeys } from '@/config/planLimits';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { isPaidUser } from '@/stores/useUserStore';
import { useDraftStore } from '../../stores/useDraftStore';
import { DraftStatus } from '../constants/farcaster';
import { Interval } from '../types/types';

type UpgradeFreePlanCardProps = {
  limitKey: PlanLimitsKeys;
  size?: 'sm' | 'lg';
};

const UpgradeFreePlanCard = ({ limitKey, size = 'sm' }: UpgradeFreePlanCardProps) => {
  const { lists } = useListStore();
  const { accounts } = useAccountStore();
  const { drafts } = useDraftStore();

  if (isPaidUser()) return null;

  const getValueForLimit = () => {
    switch (limitKey) {
      case 'maxSavedSearches':
        return lists.length;
      case 'maxAccounts':
        return accounts.length;
      case 'maxScheduledCasts':
        return drafts.filter((draft) => draft.status === DraftStatus.scheduled).length;
      case 'analyticsEnabledInterval':
        return Interval.d7;
    }
  };
  const openSourcePlanLimits = getPlanLimitsForPlan('openSource');
  const value = getValueForLimit();
  const hasReachedFreePlanLimit = value >= openSourcePlanLimits[limitKey];

  const getTitle = () => {
    switch (limitKey) {
      case 'maxSavedSearches':
        return `You have ${value} saved searches`;
      case 'maxAccounts':
        return `You have ${value} accounts`;
      case 'maxScheduledCasts':
        return `You have ${value} scheduled casts`;
      case 'analyticsEnabledInterval':
        return 'You can see analytics for the last 7 days';
    }
  };

  const getContent = () => {
    switch (limitKey) {
      case 'maxSavedSearches':
        return 'Upgrade to get more keyword feeds, alerts and scheduled casts.';
      case 'maxAccounts':
        return 'Upgrade to connect more accounts, scheduled casts and keyword alerts.';
      case 'maxScheduledCasts':
        return 'Upgrade to get more scheduled casts, keyword feeds and alerts.';
      case 'analyticsEnabledInterval':
        return 'Upgrade to get more analytics, scheduled casts and keyword alerts.';
    }
  };

  return (
    <Card className="bg-muted m-2 flex flex-col items-center justify-center h-full">
      <CardHeader>
        <CardTitle className={cn(size === 'lg' && 'text-2xl')}>{getTitle()}</CardTitle>
        <CardDescription className={cn(size === 'lg' && 'text-lg leading-tight')}>{getContent()}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href="/upgrade">
          <Button size="lg" className="w-44" variant={hasReachedFreePlanLimit ? 'default' : 'outline'}>
            Upgrade
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default UpgradeFreePlanCard;
