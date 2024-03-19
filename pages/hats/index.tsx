import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import StepSequence from "@/common/components/Steps/StepSequence";
import WalletLogin from "@/common/components/WalletLogin";
import { Button } from "@/components/ui/button";
import { ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import { useAccount, useReadContract } from "wagmi";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BigOptionSelector from "@/common/components/BigOptionSelector";
import SharedAccountOwnershipSetup from "@/common/components/SharedAccountOwnershipSetup";
import TransferAccountToHatsDelegator from "@/common/components/TransferAccountToHatsDelegator";
import FarcasterLogo from "@/common/components/FarcasterLogo";
import { openWindow } from "@/common/helpers/navigation";
import { ID_REGISTRY } from "../../src/common/constants/contracts/id-registry";
import isEmpty from "lodash.isempty";
import get from "lodash.get";
import clsx from "clsx";

enum HatsSignupNav {
  select_account = "SELECT_ACCOUNT",
  hats_protocol_setup = "HATS_PROTOCOL_SETUP",
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
    title: "Hats Protocol setup",
    idx: 1,
    key: HatsSignupNav.hats_protocol_setup,
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

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

export default function HatsProtocolPage() {
  const [step, setStep] = useState<string>(hatsSignupSteps[0].key);
  const [user, setUser] = useState<User | null>();
  const [delegatorContractAddress, setDelegatorContractAddress] = useState<
    `0x${string}` | null
  >();
  const [infoMessage, setInfoMessage] = useState<string | null>();
  const shareWithOthersText = `Join my shared Farcaster account with delegator contract
  address ${delegatorContractAddress} and FID ${user?.fid}`;
  const [didClickCopyShare, setDidClickCopyShare] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: idOfUser, error: idOfUserError } = useReadContract({
    ...ID_REGISTRY,
    functionName: address ? "idOf" : undefined,
    args: address ? [address] : undefined,
  });

  useEffect(() => {
    if (!address || !isConnected) {
      setUser(null);
      return;
    }

    const fetchUser = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

      neynarClient
        .fetchBulkUsersByEthereumAddress([address])
        .then((result) => {
          console.log("HatsProtocolPage: result", result);
          if (isEmpty(result)) {
            // fallback to idOf value from contract
            if (idOfUser) {
              neynarClient
                .fetchBulkUsers([Number(idOfUser)], {
                  viewerFid: Number(APP_FID),
                })
                .then((result) => {
                  setUser(result?.users?.[0] || null);
                });
            }
          } else {
            const user =
              get(result, address.toLowerCase())?.[0] ||
              get(result, address)?.[0] ||
              null;
            console.log("user res:", user);
            setUser(user);
          }
        })
        .catch((err) => {
          console.log("HatsProtocolPage: err getting user", err);
        });
    };

    fetchUser();
  }, [address, isConnected, idOfUser]);

  useEffect(() => {
    if (isConnected && !user) {
      setInfoMessage(
        "You are connected with wallet , but we couldn't find a Farcaster account connected to it. If you recently created a Farcaster account, it may take a few minutes for it to be indexed."
      );
    } else if (isConnected && user) {
      setInfoMessage(null);
    }
  }, [isConnected, user]);

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
        <div className="flex flex-row">
          <WalletLogin />
        </div>
        {infoMessage && (
          <p className="text-sm text-foreground/70">{infoMessage}</p>
        )}
        {user && (
          <div className="space-x-4 grid grid-cols-2 lg:grid-cols-3">
            <div className="col-span-1 lg:col-span-2">
              <Avatar className="h-14 w-14">
                <AvatarImage alt="User avatar" src={user.pfp_url} />
                <AvatarFallback>{user.username || user.fid}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h2 className="text-xl font-bold text-foreground">
                  {user?.display_name}
                </h2>
                <span className="text-sm text-foreground/80">
                  @{user?.username || user?.fid}
                </span>
              </div>
            </div>
          </div>
        )}
        <Button
          className="w-1/3"
          variant="default"
          disabled={!isConnected || !user}
          onClick={() => setStep(HatsSignupNav.hats_protocol_setup)}
        >
          Continue
        </Button>
      </div>
    );
  };

  const renderInvite = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col">
          <p className="text-lg text-semibold">
            Successfully created your shared Farcaster account 🥳
          </p>
          <p className="text-muted-foreground">
            All users with the Caster Hat in their wallet can now join!
          </p>
          <div className="mt-4 flex justify-between">
            <p className="text-foreground/70">Share this to invite other users:</p>
            <div className="flex flex-row space-x-2">
              {didClickCopyShare && (
                <p className="text-muted-foreground">Copied!</p>
              )}
              <ClipboardDocumentIcon
                className={clsx(
                  "h-5 w-5 ",
                  didClickCopyShare
                    ? "animate-pulse text-muted-foreground"
                    : "text-foreground"
                )}
                onClick={() => {
                  setDidClickCopyShare(true);
                  navigator.clipboard.writeText(shareWithOthersText);
                  setTimeout(() => {
                    setDidClickCopyShare(false);
                  }, 2000);
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-4">
            <p className="text-foreground py-2 px-3 bg-muted rounded-lg">
              {shareWithOthersText}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderStep = (step: string) => {
    switch (step) {
      case HatsSignupNav.select_account:
        return renderSelectAccount();
      case HatsSignupNav.hats_protocol_setup:
        return getStepContent(
          "Hats Protocol setup",
          "Setup your Hats tree and deploy a delegator contract",
          <BigOptionSelector
            options={[
              {
                title: "I have created a Hats tree",
                description:
                  "Continue with the setup in herocast",
                buttonText: "I have a Hats tree",
                disabled: isEmpty(user),
                onClick: () => setStep(HatsSignupNav.account_ownership),
              },
              {
                title: "I need a new Hats tree",
                description:
                  "Start your setup with Hats Protocol in the Hats app",
                buttonText: "Get started ↗️",
                onClick: () =>
                  openWindow(" https://app.hatsprotocol.xyz/trees/new"),
              },
            ]}
          />
        );
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
          <TransferAccountToHatsDelegator
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
          renderInvite()
        );
      default:
        return null;
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
      </div>
    </div>
  );
}
