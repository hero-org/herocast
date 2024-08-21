import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountStore } from '@/stores/useAccountStore';
import { Progress } from '@/components/ui/progress';
import { openSourceLimits, openSourcePlanLimits } from '@/config/customerLimitation';
import Link from 'next/link';
import { useListStore } from '@/stores/useListStore';
import { useDraftStore } from '../../stores/useDraftStore';
import { DraftStatus } from '../constants/farcaster';
import { Button } from '@/components/ui/button';
import { isPaidUser } from '@/stores/useUserStore';

type UpgradeFreePlanCardProps = {
  limit: openSourceLimits;
};

const UpgradeFreePlanCard = ({ limit }: UpgradeFreePlanCardProps) => {
  const { lists } = useListStore();
  const { accounts } = useAccountStore();
  const { drafts } = useDraftStore();

  if (isPaidUser()) return null;

  const getValueForLimit = () => {
    switch (limit) {
      case 'maxSavedSearches':
        return lists.length;
      case 'maxAccounts':
        return accounts.length;
      case 'maxScheduledCasts':
        return drafts.filter((draft) => draft.status === DraftStatus.scheduled).length;
    }
  };
  const value = getValueForLimit();
  const hasReachedFreePlanLimit = value >= openSourcePlanLimits[limit];

  const getTitle = () => {
    switch (limit) {
      case 'maxSavedSearches':
        return `You have ${value} saved searches`;
      case 'maxAccounts':
        return `You have ${value} accounts`;
      case 'maxScheduledCasts':
        return `You have ${value} scheduled casts`;
    }
  };

  const getContent = () => {
    switch (limit) {
      case 'maxSavedSearches':
        return 'Upgrade to get more saved searches.';
      case 'maxAccounts':
        return 'Upgrade to get more accounts.';
      case 'maxScheduledCasts':
        return 'Upgrade to get more scheduled casts.';
    }
  };

  return (
    <Card className="bg-muted m-2 flex flex-col text-center items-center justify-center h-full">
      <CardTitle className="bg-muted-foreground/20 h-10 pt-2 rounded-t-xl w-full items-center text-sm">
        {getTitle()}
      </CardTitle>
      <CardContent className="flex flex-col items-center gap-2 mt-4">
        <span className="text-muted-foreground">{getContent()}</span>
      </CardContent>
      <CardFooter>
        <Link href="/upgrade" prefetch={false}>
          <Button className="w-44" size="sm" variant={hasReachedFreePlanLimit ? 'default' : 'outline'}>
            Upgrade
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default UpgradeFreePlanCard;
