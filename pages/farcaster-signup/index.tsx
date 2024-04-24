import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import StepSequence from "@/common/components/Steps/StepSequence";
import RegisterFarcasterUsernameForm from "@/common/components/RegisterFarcasterUsernameForm";
import CreateFarcasterAccount from "@/common/components/CreateFarcasterAccount";
import { useAccount } from "wagmi";
import { useRouter } from "next/router";
import SwitchWalletButton from "@/common/components/SwitchWalletButton";
import { hydrateAccounts } from "../../src/stores/useAccountStore";
import { getFidForAddress } from "@/common/helpers/farcaster";

enum FarcasterSignupNav {
  login = "LOGIN",
  connect_wallet = "CONNECT_WALLET",
  create_account_onchain = "CREATE_ACCOUNT_ONCHAIN",
  register_username = "REGISTER_USERNAME",
  explainer = "EXPLAINER",
}

const onboardingNavItems = [
  {
    title: "Login",
    idx: 0,
    key: FarcasterSignupNav.login,
  },
  {
    title: "Connect wallet",
    idx: 1,
    key: FarcasterSignupNav.connect_wallet,
  },
  {
    title: "Create account onchain",
    idx: 2,
    key: FarcasterSignupNav.create_account_onchain,
  },
  {
    title: "Register username",
    idx: 3,
    key: FarcasterSignupNav.register_username,
  },
  {
    title: "Let's go",
    idx: 3,
    key: FarcasterSignupNav.explainer,
  },
];

export default function Welcome() {
  const { isConnected, address } = useAccount();
  const [step, setStep] = useState<string>(onboardingNavItems[1].key);
  const [isAddressValid, setIsAddressValid] = useState<Boolean>(false);
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

  const getStepContent = (
    title: string,
    description: string,
    children?: ReactNode
  ) => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />
      {children}
    </div>
  );

  useEffect(() => {
    validateWalletHasNoFid();
  }, [isConnected, address]);

  const validateWalletHasNoFid = async (): Promise<void> => {
    setError('') // reset
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
      <h3 className="mb-4 text-lg font-medium">
        You are fully onboarded to herocast 🥳
      </h3>
      <div className="w-1/2 grid grid-cols-1 items-center gap-4">
        <Button variant="default" onClick={() => router.push("/feed")}>
          Start exploring your feed
        </Button>
        <Button variant="outline" onClick={() => router.push("/post")}>
          Post your first cast
        </Button>
        <div className="w-full">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => router.push("/hats")}
          >
            Share this account with others
          </Button>
          <p className="mt-1 text-sm text-gray-700">
            Use Hats Protocol to share this account with onchain permissions
          </p>
        </div>
      </div>
      <div className="mt-12 space-y-4">
        {/* <div className="w-[500px]">
          <AspectRatio ratio={16 / 9}>
            // can fill in video embed explainer here
          </AspectRatio>
        </div> */}
      </div>
    </div>
  );

  const renderStep = (step: FarcasterSignupNav) => {
    switch (step) {
      case FarcasterSignupNav.login:
        return getStepContent(
          "Login",
          "Congrats, you are already logged in to herocast."
        );
      case FarcasterSignupNav.connect_wallet:
        return getStepContent(
          "Connect your wallet",
          "We will create a Farcaster account onchain in the next step.",
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
                <p className="text-wrap break-all	text-sm text-red-500">
                  {error}
                </p>
              </div>
            )}
            {error && isAddressValid && (
              <div className="flex flex-start items-center mt-2">
                <p className="text-wrap break-all	text-sm text-red-500">
                  Error: {error}
                </p>
              </div>
            )}
          </div>
        );
      case FarcasterSignupNav.create_account_onchain:
        return getStepContent(
          "Create your Farcaster account",
          "Let's get you onchain",
          <CreateFarcasterAccount
            isAddressValid={isAddressValid}
            onSuccess={async () => {
              await hydrateAccounts();
              setStep(FarcasterSignupNav.register_username)
            }}
          />
        );
      case FarcasterSignupNav.register_username:
        // skipped for now
        return getStepContent(
          "Register your username",
          "Submit name and bio of your Farcaster account",
          <RegisterFarcasterUsernameForm
            onSuccess={() => setStep(FarcasterSignupNav.explainer)}
          />
        );
      case FarcasterSignupNav.explainer:
        return getStepContent(
          "Let's go 🤩",
          "You just created your Farcaster account",
          renderExplainer()
        );
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
