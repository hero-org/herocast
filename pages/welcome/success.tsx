import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  RectangleGroupIcon,
} from '@heroicons/react/20/solid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { useDraftStore } from '@/stores/useDraftStore';
import { JoinedHerocastPostDraft } from '@/common/constants/postDrafts';
import Link from 'next/link';
import findIndex from 'lodash.findindex';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { DraftStatus } from '@/common/constants/farcaster';

enum OnboardingStep {
  login_to_herocast = 'login_to_herocast',
  connect_farcaster_account = 'connect_farcaster_account',
  setup_keyword_alert = 'setup_keyword_alert',
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
    key: OnboardingStep.setup_keyword_alert,
    title: 'Setup keyword alerts and daily email',
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
  const [step, setStep] = useState<OnboardingStep>(OnboardingStep.setup_keyword_alert);
  const [taskStatus, setTaskStatus] = useState<OnboardingTaskStatus>({
    [OnboardingStep.login_to_herocast]: true,
    [OnboardingStep.connect_farcaster_account]: true,
    [OnboardingStep.setup_keyword_alert]: false,
    [OnboardingStep.pin_channels]: false,
    [OnboardingStep.schedule_cast]: false,
  });

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft);
    router.push('/post');
  };

  const hasScheduledCasts =
    drafts.filter((draft) => draft.status === DraftStatus.scheduled || draft.status === DraftStatus.published).length >
    0;

  useEffect(() => {
    if (hasScheduledCasts) {
      setTaskStatus(prev => ({ ...prev, [OnboardingStep.schedule_cast]: true }));
    }
  }, [hasScheduledCasts]);

  const currentStepIdx = findIndex(onboardingSteps, (item) => item.key === step);
  const progressPercent = (Object.values(taskStatus).filter(Boolean).length / (onboardingSteps.length - 1)) * 100;

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
                    setTaskStatus(prev => ({ ...prev, [step.key]: true }));
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

  return (
    <div className="w-full flex flex-col mt-24 items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">Welcome to herocast</h2>
        <div className="max-w-xl mx-auto">
          <Card className="min-w-max bg-background text-foreground">
            <CardContent className="p-4">
              <div className="flex flex-col gap-y-4 text-left">
                <div>
                  <span className="text-md font-semibold">
                    Complete these tasks to get the full herocast experience
                  </span>
                </div>
                <div className="space-y-4 py-4 block">{renderOnboardingSteps()}</div>
                <Progress
                  value={progressPercent}
                  indicatorClassName="bg-gradient-to-r from-green-400 to-green-600 animate-pulse"
                />
                <div className="gap-x-4 mt-2 flex">
                  <Link href="/search">
                    <Button 
                      size="lg" 
                      type="button" 
                      variant="default"
                      onClick={() => setTaskStatus(prev => ({ ...prev, [OnboardingStep.setup_keyword_alert]: true }))}
                    >
                      <MagnifyingGlassIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Setup keyword alerts
                    </Button>
                  </Link>
                  <Link href="/channels">
                    <Button 
                      size="lg" 
                      type="button" 
                      variant="outline"
                      onClick={() => setTaskStatus(prev => ({ ...prev, [OnboardingStep.pin_channels]: true }))}
                    >
                      <RectangleGroupIcon className="mr-1.5 mt-0.5 h-4 w-4" aria-hidden="true" />
                      Pin channels
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => {
                      onStartCasting();
                      setTaskStatus(prev => ({ ...prev, [OnboardingStep.schedule_cast]: true }));
                    }} 
                    type="button" 
                    variant="outline" 
                    size="lg"
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
