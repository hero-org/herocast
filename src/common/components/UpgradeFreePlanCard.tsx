import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountStore } from '@/stores/useAccountStore';
import Link from 'next/link';
import { useListStore } from '@/stores/useListStore';
import { useDraftStore } from '../../stores/useDraftStore';
import { DraftStatus } from '../constants/farcaster';
import { Button } from '@/components/ui/button';
import { isPaidUser } from '@/stores/useUserStore';
import { getPlanLimitsForUser, PlanLimitsKeys } from '@/config/planLimits';

type UpgradeFreePlanCardProps = {
  limitKey: PlanLimitsKeys;
};

const UpgradeFreePlanCard = ({ limitKey }: UpgradeFreePlanCardProps) => {
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
      case 'maxScheduledCasts':
        console.log('drafts', drafts);
        return drafts.filter((draft) => draft.status === DraftStatus.scheduled).length;
    }
  };
  const openSourcePlanLimits = getPlanLimitsForUser('openSource');
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
    }
  };

  return (
    <Card className="bg-muted m-2 flex flex-col items-center justify-center h-full">
      <CardHeader>
        <CardTitle>{getTitle()}</CardTitle>
        <CardDescription>{getContent()}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href="/upgrade">
          <Button className="w-44" variant={hasReachedFreePlanLimit ? 'default' : 'outline'}>
            Upgrade
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default UpgradeFreePlanCard;
