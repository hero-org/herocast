import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/router";
import StepSequence from "@/common/components/Steps/StepSequence";
import WalletLogin from "@/common/components/WalletLogin";
import GenerateHatsProtocolTransferSignature from "./GenerateHatsProtocolTransferSignature";
import { Button } from "@/components/ui/button";
import SharedAccountOwnershipSetup from "./SharedAccountOwnershipSetup";
import {
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/20/solid";
import { useAccount } from "wagmi";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

enum HatsSignupNav {
  select_account = "SELECT_ACCOUNT",
  hats_tree = "HATS_TREE",
  account_ownership = "ACCOUNT_OWNERSHIP",
  transfer_ownership = "TRANSFER_OWNERSHIP",
  invite = "INVITE",
}

const hatsSignupSteps = [
  {
    title: "Select account",
    idx: 0,
    key: HatsSignupNav.select_account,
  },
  {
    title: "Account ownership",
    idx: 2,
    key: HatsSignupNav.account_ownership,
  },
  {
    title: "Transfer ownership",
    idx: 3,
    key: HatsSignupNav.transfer_ownership,
  },
  {
    title: "Invite others",
    idx: 4,
    key: HatsSignupNav.invite,
  },
];

export default function HatsProtocolPage() {
  const router = useRouter();
  const [step, setStep] = useState<string>(hatsSignupSteps[1].key);
  const [user, setUser] = useState<User | null>();
  const [delegatorContractAddress, setDelegatorContractAddress] = useState<
    `0x${string}` | null
  >();

  const { address, isConnected } = useAccount();

  useEffect(() => {
    if (!address) return;
    if (!isConnected) {
      setUser(null);
      return;
    }

    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    neynarClient.lookupUserByCustodyAddress(address).then((result) => {
      setUser(result?.user);
    });
  }, [address, isConnected]);

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

  const renderSelectAccount = () => {
    return getStepContent(
      "Select account",
      "You need to connect your wallet to select a Farcaster account to share",
      <div className="flex flex-col space-y-8">
        <WalletLogin />
        {user ? (
          <div className="space-x-4 grid grid-cols-2 lg:grid-cols-3">
            <div className="col-span-1 lg:col-span-2">
              <Avatar className="h-14 w-14">
                <AvatarImage alt="User avatar" src={user.pfp_url} />
                <AvatarFallback>{user.username}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-200">
                  {user?.display_name}
                </h2>
                <span className="text-sm text-foreground/80">
                  @{user?.username}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <Button
          className="w-1/3"
          variant="default"
          onClick={() => setStep(HatsSignupNav.account_ownership)}
        >
          Continue
        </Button>
      </div>
    );
  };

  const renderStep = (step: string) => {
    switch (step) {
      case HatsSignupNav.select_account:
        return renderSelectAccount();
      case HatsSignupNav.account_ownership:
        return getStepContent(
          "Account ownership",
          "Decide where the Farcaster account will be owned and managed",
          <SharedAccountOwnershipSetup
            onSuccess={() => setStep(HatsSignupNav.transfer_ownership)}
            delegatorContractAddress={delegatorContractAddress}
            setDelegatorContractAddress={setDelegatorContractAddress}
          />
        );
      case HatsSignupNav.transfer_ownership:
        return getStepContent(
          "Transfer ownership",
          "Send your Farcaster account to the delegator contract",
          <GenerateHatsProtocolTransferSignature 
            onSuccess={() => setStep(HatsSignupNav.invite)}
            fid={BigInt(user?.fid || 0)}
            fromAddress={address!}
            toAddress={delegatorContractAddress!}
          />
        );
      case HatsSignupNav.invite:
        return getStepContent(
          "Invite others",
          "Let other users join your shared account",
          <div className="space-y-6">
            <div className="flex flex-col space-y-4">
              <p className="text-lg text-semibold">
                Successfully created your shared Farcaster account 🥳
              </p>
              <div className="mt-4 flex items-center space-x-4">
                <p className="text-foreground/70">Invite link</p>
                <p className="text-foreground py-2 px-3 bg-muted rounded-lg">
                  https://app.herocast.xyz/invite/1234
                </p>
                <ClipboardDocumentIcon className="h-5 w-5 text-foreground" />
                <PaperAirplaneIcon className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderNextButton = (step: string) => {
    // based on step index in the array, render the next button
    const stepIdx = hatsSignupSteps.findIndex((s) => s.key === step);
    const nextStep = hatsSignupSteps[stepIdx + 1];
    if (nextStep) {
      return (
        <Button variant="default" onClick={() => setStep(nextStep.key)}>
          Next
        </Button>
      );
    }
  };

  return (
    <div className="w-full">
      <div className="space-y-6 p-4 pb-16 block">
        <StepSequence
          title="Create a shared Farcaster account"
          description="powered by Hats Protocol 🧢"
          step={step}
          setStep={setStep}
          navItems={hatsSignupSteps}
          renderStep={renderStep}
        />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0"></div>
      </div>
    </div>
  );
}
