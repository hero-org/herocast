import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import StepSequence from "@/common/components/Steps/StepSequence";
import WalletLogin from "@/common/components/WalletLogin";
import CreateFarcasterAccountForm from "@/common/components/CreateFarcasterAccountForm";
import { useAccount } from "wagmi";

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
  const [step, setStep] = useState<string>(onboardingNavItems[0].key);

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
          <div></div>
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
