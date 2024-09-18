import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, MagnifyingGlassIcon, PencilSquareIcon, RectangleGroupIcon } from '@heroicons/react/20/solid';
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
              {!taskStatus[step.key] && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 ml-2"
                  onClick={() => {
                    setTaskStatus((prev) => {
                      const newStatus = { ...prev, [step.key]: true };
                      return newStatus;
                    });
                    setStep(onboardingSteps[idx + 1]?.key);
                  }}
                >
                  Skip
                </Button>
              )}
            </div>
          </div>
        );
      });
  };

  const renderGloPromoCard = () => {
    return (
      <Card className="bg-background text-foreground">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-semibold">
            <img
              src="https://github.com/hero-org/.github/blob/main/assets/IMAGE%202024-06-13%2013:12:57.jpg?raw=true"
              className="h-10 -ml-1"
            />
            Get 2 USDGLO
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <CardDescription className="text-lg text-card-foreground">
            Set up a herocast account and schedule a cast to get 2 USDGLO. <br />
            If you already have an account, schedule two casts.
            <br />
            Glo Dollar is a fiat-backed stablecoin that funds public goods. <br />
            This is a limited time offer until Dec 17, 2024 or until our budget is depleted.
            <br />
            <br />
            <a
              href="https://www.glodollar.org/articles/how-glo-dollar-works"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Learn more →
            </a>
          </CardDescription>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full flex flex-col mt-24 items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">Welcome to herocast ✨</h2>
        <div className="max-w-max mx-auto">
          <Card className="bg-background text-foreground">
            <CardContent className="max-w-2xl p-4">
              <div className="flex flex-col gap-y-4 text-left">
                <div>
                  <span className="text-md font-semibold">
                    {isCompleted ? 'Enjoy herocast' : 'Complete these tasks to get the most out of herocast'}
                  </span>
                </div>
                <div className="space-y-4 py-4 block">{renderOnboardingSteps()}</div>
                <Progress
                  value={progressPercent}
                  indicatorClassName="bg-gradient-to-r from-green-400 to-green-600 animate-pulse"
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
                  <Link href="/search">
                    <Button size="lg" type="button" variant="default" className="min-w-full px-2">
                      <MagnifyingGlassIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Create keyword alerts
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
                {renderGloPromoCard()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomeSuccessPage;
