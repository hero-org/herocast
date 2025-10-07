'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  RectangleGroupIcon,
  UserIcon,
} from '@heroicons/react/20/solid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { useDraftStore } from '@/stores/useDraftStore';
import { JoinedHerocastPostDraft } from '@/common/constants/postDrafts';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { DraftStatus } from '@/common/constants/farcaster';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { LOCAL_STORAGE_ONBOARDING_COMPLETED_KEY } from '@/common/constants/localStorage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';

enum OnboardingStep {
  login_to_herocast = 'login_to_herocast',
  connect_farcaster_account = 'connect_farcaster_account',
  create_keyword_alert = 'create_keyword_alert',
  pin_channels = 'pin_channels',
  schedule_cast = 'schedule_cast',
  done = 'done',
}

interface OnboardingTaskStatus {
  [key: string]: boolean;
}

const onboardingSteps = [
  {
    key: OnboardingStep.login_to_herocast,
    title: 'Login to herocast',
  },
  {
    key: OnboardingStep.connect_farcaster_account,
    title: 'Connect Farcaster account',
  },
  {
    key: OnboardingStep.create_keyword_alert,
    title: 'Create keyword alerts and daily email',
  },
  {
    key: OnboardingStep.pin_channels,
    title: 'Pin channels',
  },
  {
    key: OnboardingStep.schedule_cast,
    title: 'Schedule casts',
  },
  {
    key: OnboardingStep.done,
    title: 'Done',
    hide: true,
  },
];

const WelcomeSuccessPage = () => {
  const router = useRouter();
  const { drafts, addNewPostDraft } = useDraftStore();
  const [step, setStep] = useState<OnboardingStep>(OnboardingStep.create_keyword_alert);
  const [taskStatus, setTaskStatus] = useState<OnboardingTaskStatus>({
    [OnboardingStep.login_to_herocast]: true,
    [OnboardingStep.connect_farcaster_account]: true,
    [OnboardingStep.create_keyword_alert]: false,
    [OnboardingStep.pin_channels]: false,
    [OnboardingStep.schedule_cast]: false,
  });

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft);
    router.push('/post');
  };

  const accounts = useAccountStore((state) => state.accounts);
  const selectedAccountIdx = useAccountStore((state) => state.selectedAccountIdx);
  const connectedAccount = accounts[selectedAccountIdx];
  const hasPinnedChannels = accounts && accounts.some((account) => account?.channels.length > 0);
  const hasScheduledCasts =
    drafts.filter((draft) => draft.status === DraftStatus.scheduled || draft.status === DraftStatus.published).length >
    0;
  const hasSavedSearches = useListStore((state) => state.lists.length > 0);

  useEffect(() => {
    if (hasScheduledCasts) {
      setTaskStatus((prev) => ({ ...prev, [OnboardingStep.schedule_cast]: true }));
    }
  }, [hasScheduledCasts]);

  useEffect(() => {
    if (hasPinnedChannels) {
      setTaskStatus((prev) => ({ ...prev, [OnboardingStep.pin_channels]: true }));
    }
  }, [hasPinnedChannels]);

  useEffect(() => {
    if (hasSavedSearches) {
      setTaskStatus((prev) => ({ ...prev, [OnboardingStep.create_keyword_alert]: true }));
    }
  }, [hasSavedSearches]);

  const progressPercent = (Object.values(taskStatus).filter(Boolean).length / (onboardingSteps.length - 1)) * 100;
  const isCompleted = Object.values(taskStatus).every(Boolean);

  useEffect(() => {
    if (isCompleted) {
      localStorage.setItem(LOCAL_STORAGE_ONBOARDING_COMPLETED_KEY, 'true');
      // dispatch event to notify all open tabs (including the one setting it)
      const event = new StorageEvent('storage', {
        key: LOCAL_STORAGE_ONBOARDING_COMPLETED_KEY,
        oldValue: undefined,
        newValue: 'true',
      });
      window.dispatchEvent(event);
    }
  }, [isCompleted]);

  const renderOnboardingSteps = () => {
    return onboardingSteps
      .filter((step) => !step?.hide)
      .map((step, idx) => {
        return (
          <div key={step.key} className="flex items-center justify-between">
            <div className="flex items-center align-middle">
              <div className="flex-shrink-0 mr-2">
                {taskStatus[step.key] ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                ) : (
                  <Checkbox checked={false} className="cursor-default ml-0.5 mt-1 h-5 w-5 rounded-lg" />
                )}
              </div>
              {step.title}
            </div>
          </div>
        );
      });
  };

  return (
    <div className="w-full flex flex-col mt-20 items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">welcome to herocast ✨</h2>

        {connectedAccount && (
          <div className="max-w-2xl mx-auto space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={connectedAccount.user?.pfp_url} alt={connectedAccount.name} />
                      <AvatarFallback>{connectedAccount.name?.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-lg font-semibold">
                      @{connectedAccount.name || connectedAccount.user?.username} is now connected to your herocast
                      account
                    </span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Button
                onClick={() => router.push(`/profile/@${connectedAccount.name || connectedAccount.user?.username}`)}
                size="lg"
                variant="outline"
                className="gap-2"
              >
                <UserIcon className="h-4 w-4" />
                View Profile
              </Button>
            </div>
          </div>
        )}

        <div className="max-w-max mx-auto">
          <Card className="bg-background text-foreground">
            <CardContent className="max-w-2xl p-4">
              <div className="flex flex-col gap-y-4 text-left">
                {!isCompleted && (
                  <div>
                    <span className="text-md font-semibold">Complete these tasks to get the most out of herocast</span>
                  </div>
                )}
                <div className="space-y-4 py-4 block">{renderOnboardingSteps()}</div>
                <Progress
                  value={progressPercent}
                  indicatorClassName="bg-gradient-to-r from-green-400 to-green-600 animate-pulse"
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
                  <Link href="/lists">
                    <Button size="lg" type="button" variant="default" className="min-w-full px-2">
                      <MagnifyingGlassIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Create friends list
                    </Button>
                  </Link>
                  <Link href="/channels">
                    <Button size="lg" type="button" variant="outline" className="min-w-full px-2">
                      <RectangleGroupIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Pin channels
                    </Button>
                  </Link>
                  <Button
                    onClick={() => onStartCasting()}
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-w-full px-2"
                  >
                    <PencilSquareIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                    Schedule casts
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomeSuccessPage;
