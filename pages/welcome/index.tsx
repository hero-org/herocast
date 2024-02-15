import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import StepSequence from "@/common/components/Steps/StepSequence";
import WalletLogin from "@/common/components/WalletLogin";
import CreateFarcasterAccountForm from "@/common/components/CreateFarcasterAccountForm";
import { useAccount } from "wagmi";
import Image from "next/image";
import { useRouter } from "next/router";

enum OnboardingNav {
  login = "LOGIN",
  connect_wallet = "CONNECT_WALLET",
  create_account = "CREATE_ACCOUNT",
  explainer = "EXPLAINER",
}

const onboardingNavItems = [
  {
    title: "Login",
    idx: 0,
    key: OnboardingNav.login,
  },
  {
    title: "Connect wallet",
    idx: 1,
    key: OnboardingNav.connect_wallet,
  },
  {
    title: "Create account",
    idx: 2,
    key: OnboardingNav.create_account,
  },
  {
    title: "Let's go",
    idx: 3,
    key: OnboardingNav.explainer,
  },
];

export default function Welcome() {
  const { isConnected } = useAccount();
  const [step, setStep] = useState<string>(onboardingNavItems[1].key);
  const router = useRouter();
  
  useEffect(() => {
    if (isConnected && step === OnboardingNav.connect_wallet) {
      setStep(OnboardingNav.create_account);
    }
  }, [isConnected]);

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

  const renderExplainer = () => (
    <div>
      <h3 className="mb-4 text-lg font-medium">
        You are fully onboarded to herocast 🥳
      </h3>
      <div className="flex items-center space-x-2">
        <Button variant="default" onClick={() => router.push('/feed')}>Start exploring your feed</Button>
        <Button variant="outline" onClick={() => router.push('/post')}>Post your first cast</Button>
        </div>
      <div className="mt-12 space-y-4">
        <div className="w-[800px]">
          <AspectRatio ratio={16 / 9}>
            <Image width="1000" height="1000" src="https://images.unsplash.com/photo-1494523374364-46c364c83b60?q=80&w=2532&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Image" className="rounded-md object-cover" />
          </AspectRatio>
        </div>
      </div>
    </div>
  );

  const renderStep = (step: OnboardingNav) => {
    switch (step) {
      case OnboardingNav.login:
        return getStepContent(
          "Login",
          "Congrats, you are already logged in to herocast."
        );
      case OnboardingNav.connect_wallet:
        return getStepContent(
          "Connect your wallet",
          "We will create a Farcaster account onchain in the next step.",
          <WalletLogin />
        );
      case OnboardingNav.create_account:
        return getStepContent(
          "Create your Farcaster account",
          "Let's bring your account onchain",
          <CreateFarcasterAccountForm
            onSuccess={() => setStep(OnboardingNav.explainer)}
          />
        );
      case OnboardingNav.explainer:
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
    <StepSequence
      title="Welcome to herocast"
      description="Follow these steps to create your Farcaster account"
      step={step}
      setStep={setStep}
      navItems={onboardingNavItems}
      renderStep={renderStep}
    />
  );
}
