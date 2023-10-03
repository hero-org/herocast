import React, { useState } from "react";
import WarpcastLogin from "@/common/components/WarpcastLogin";
import WalletLogin from "@/common/components/WalletLogin";
import { CheckCircleIcon, PlusCircleIcon, RectangleGroupIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/24/solid";
import { JoinedHerocastPostDraft, useNewPostStore } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { AccountStatusType } from "@/common/constants/accounts";
import { useNavigate } from "react-router-dom";
import { classNames } from "@/common/helpers/css";
import { Button } from 'react-daisyui';

enum SignupStateEnum {
  "initial",
  "connecting",
  "done",
}

type SignupStepType = {
  state: SignupStateEnum;
  title: string;
  description: string;
  idx: number;
}

const SignupSteps: SignupStepType[] = [
  {
    state: SignupStateEnum.initial,
    title: 'Start adding Farcaster accounts',
    description: 'Get started with herocast',
    idx: 0,
  },
  {
    state: SignupStateEnum.connecting,
    title: 'Connect account',
    description: 'Connect your Farcaster account to herocast',
    idx: 1,
  },
  {
    state: SignupStateEnum.done,
    title: 'Start casting',
    description: 'Start casting and browsing your feed',
    idx: 2,
  },
]

export default function Accounts() {
  const navigate = useNavigate();
  const [signupState, setSignupState] = useState<SignupStepType>(SignupSteps[1]);

  const {
    accounts,
  } = useAccountStore();

  const {
    addNewPostDraft,
  } = useNewPostStore();

  const hasActiveAccounts = !isEmpty(accounts.filter((account) => account.status === AccountStatusType.active));

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft)
    navigate('/post');
  }

  const renderCreateSignerStep = () => (
    <div className="card w-96 rounded-sm bg-primary text-primary-content">
      <div className="card-body">
        <h2 className="card-title">Card title!</h2>
        <p>If a dog chews shoes whose shoes does he choose?</p>
        <div className="card-actions justify-end">
          <button className="btn">Buy Now</button>
        </div>
      </div>
    </div>
  )

  const renderConnectAccountStep = () => (
    <>
      <div className="grid h-20 flex-grow card rounded-sm bg-gray-600 rounded-box place-items-center">
        <WarpcastLogin />
      </div>
      <div className="text-gray-100 divider divider-horizontal">OR</div>
      <div className="grid flex-grow card rounded-sm bg-gray-600 rounded-box place-items-center">
        <div className="card-body">
          <h2 className="card-title">Card title!</h2>
          <p>If a dog chews shoes whose shoes does he choose?</p>
          <div className="card-actions justify-start">
            {/* <button className="btn">Buy Now</button> */}
            <WalletLogin />
          </div>
        </div>
      </div>
    </>
  )

  const renderDoneStep = () => (
    <div className="mt-10 max-w-xl rounded-sm bg-green-800/50 px-4 py-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <CheckCircleIcon className="h-5 w-5 text-gray-100" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-gray-100">Account added to herocast</h3>
          <div className="mt-2 text-sm text-gray-300">
            <p>You can start casting and browsing your feed</p>
          </div>
          <div className="mt-4">
            <div className="-mx-2 -my-1.5 flex">
              <button
                onClick={() => onStartCasting()}
                type="button"
                className="flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
              >
                Start casting
                <PlusCircleIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
              </button>
              <button
                onClick={() => navigate('/feed')}
                type="button"
                className="ml-4 flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
              >
                Scroll your feed
                <NewspaperIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
              </button>
              <button
                onClick={() => navigate('/channels')}
                type="button"
                className="ml-4 flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
              >
                Pin your favourite channels
                <RectangleGroupIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ml-4 flex min-w-full flex-col">
      <div>
        <h1 className="mb-4 text-lg font-bold tracking-tight text-gray-200 sm:text-4xl">
          Connect Farcaster accounts
        </h1>
        <div className="text-gray-200 mb-8">
          <ul className="steps steps-vertical lg:steps-horizontal">
            {SignupSteps.map((step, idx) => (
              <li
                key={idx}
                className={classNames(
                  step.idx === signupState.idx ? 'step step-primary' : 'step',
                  step.idx < signupState.idx ? 'step-primary' : '',
                )}
              >
                {step.title}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex w-full max-w-2xl">
          {signupState.state === SignupStateEnum.initial && renderCreateSignerStep()}
          {signupState.state === SignupStateEnum.connecting && renderConnectAccountStep()}
          {signupState.state === SignupStateEnum.done && renderDoneStep()}
        </div>
      </div>
      <Button onClick={() => setSignupState(SignupSteps[signupState.idx + 1])} disabled={!hasActiveAccounts}>
        next
      </Button>
      <Button onClick={() => setSignupState(SignupSteps[0])} disabled={!hasActiveAccounts}>
        reset
      </Button>
    </div>
  )
}
