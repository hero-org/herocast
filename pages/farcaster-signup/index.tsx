import React, { ReactNode, useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import StepSequence from '@/common/components/Steps/StepSequence';
import RegisterFarcasterUsernameForm from '@/common/components/RegisterFarcasterUsernameForm';
import CreateFarcasterAccount from '@/common/components/CreateFarcasterAccount';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/router';
import SwitchWalletButton from '@/common/components/SwitchWalletButton';
import { CUSTOM_CHANNELS, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { SidebarNavItem } from '@/common/components/Steps/SidebarNav';
import { getFidForAddress } from '@/common/helpers/farcaster';

enum FarcasterSignupNav {
  login = 'LOGIN',
  connect_wallet = 'CONNECT_WALLET',
  create_account_onchain = 'CREATE_ACCOUNT_ONCHAIN',
  register_username = 'REGISTER_USERNAME',
  explainer = 'EXPLAINER',
}

const onboardingNavItems: SidebarNavItem[] = [
  {
    title: 'Login',
    idx: 0,
    keys: [FarcasterSignupNav.login],
  },
  {
    title: 'Connect wallet',
    idx: 1,
    keys: [FarcasterSignupNav.connect_wallet],
  },
  {
    title: 'Create account onchain',
    idx: 2,
    keys: [FarcasterSignupNav.create_account_onchain],
  },
  {
    title: 'Register username',
    idx: 3,
    keys: [FarcasterSignupNav.register_username],
  },
  {
    title: "Let's go",
    idx: 3,
    keys: [FarcasterSignupNav.explainer],
  },
];

export default function Welcome() {
  const { isConnected, address } = useAccount();
  const [step, setStep] = useState<FarcasterSignupNav>(FarcasterSignupNav.connect_wallet);
  const { setSelectedChannelUrl } = useAccountStore();

  const [isAddressValid, setIsAddressValid] = useState<boolean>(false);
  const router = useRouter();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (isConnected && step === FarcasterSignupNav.connect_wallet && isAddressValid) {
      setStep(FarcasterSignupNav.create_account_onchain);
    }

    if (!isConnected && step === FarcasterSignupNav.create_account_onchain) {
      setStep(FarcasterSignupNav.connect_wallet);
    }
  }, [isConnected, isAddressValid]);

  const getStepContent = (title: string, description: string, children?: ReactNode) => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />
      <div className="w-full max-w-sm lg:max-w-lg">{children}</div>
    </div>
  );

  useEffect(() => {
    validateWalletHasNoFid();
  }, [isConnected, address]);

  const validateWalletHasNoFid = async (): Promise<void> => {
    setError('');
    if (!isConnected || !address) {
      return;
    }

    const fid = await getFidForAddress(address);
    if (fid) {
      setError(
        `Wallet ${address} already has a registered FID: ${fid}. Please connect to another wallet that is not registered to an account to continue.`
      );
      setIsAddressValid(false);
    } else {
      setIsAddressValid(true);
    }
  };

  const renderExplainer = () => (
    <div>
      <h3 className="mb-4 text-lg font-medium">You are fully onboarded to herocast 🥳</h3>
      <div className="grid grid-cols-1 items-center gap-4">
        <Button
          variant="default"
          onClick={() => {
            setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING);
            router.push('/post');
          }}
        >
          Start exploring
        </Button>
        <Button variant="outline" onClick={() => router.push('/post')}>
          Post your first cast
        </Button>
      </div>
    </div>
  );

  const renderStep = (step: FarcasterSignupNav) => {
    switch (step) {
      case FarcasterSignupNav.login:
        return getStepContent(
          'Login',
          'Congrats, you are already logged in to herocast.',
          <div className="flex flex-col gap-4">
            <Button onClick={() => setStep(FarcasterSignupNav.connect_wallet)}>Next step</Button>
          </div>
        );
      case FarcasterSignupNav.connect_wallet:
        return getStepContent(
          'Connect your wallet',
          'We will create a Farcaster account onchain in the next step.',
          <div className="flex flex-col gap-4">
            <SwitchWalletButton />
            <Separator />
            <Button
              disabled={!isConnected || !isAddressValid}
              onClick={() => setStep(FarcasterSignupNav.create_account_onchain)}
            >
              Next step
            </Button>
            {!isAddressValid && (
              <div className="flex flex-start items-center mt-2">
                <p className="text-wrap break-all	text-sm text-red-500">{error}</p>
              </div>
            )}
            {error && isAddressValid && (
              <div className="flex flex-start items-center mt-2">
                <p className="text-wrap break-all	text-sm text-red-500">Error: {error}</p>
              </div>
            )}
          </div>
        );
      case FarcasterSignupNav.create_account_onchain:
        return getStepContent(
          'Create your Farcaster account',
          "Let's get you onchain",
          <CreateFarcasterAccount
            isAddressValid={isAddressValid}
            onSuccess={async () => {
              await hydrateAccounts();
              setStep(FarcasterSignupNav.register_username);
            }}
          />
        );
      case FarcasterSignupNav.register_username:
        return getStepContent(
          'Register your username',
          'Submit name and bio of your Farcaster account',
          <RegisterFarcasterUsernameForm onSuccess={() => setStep(FarcasterSignupNav.explainer)} />
        );
      case FarcasterSignupNav.explainer:
        return getStepContent("Let's go 🤩", 'You just created your Farcaster account', renderExplainer());
      default:
        return <></>;
    }
  };

  return (
    <div className="space-y-6 p-4 pb-16 block">
      <StepSequence
        title="Welcome to herocast"
        description="Follow these steps to create your Farcaster account"
        step={step}
        setStep={setStep}
        navItems={onboardingNavItems}
        renderStep={renderStep}
      />
    </div>
  );
}
