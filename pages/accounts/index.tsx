import React, { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  PlusCircleIcon,
  RectangleGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, NewspaperIcon } from "@heroicons/react/24/solid";
import {
  JoinedHerocastPostDraft,
  useNewPostStore,
} from "../../src/stores/useNewPostStore";
import { hydrate, useAccountStore } from "../../src/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import {
  AccountPlatformType,
  AccountStatusType,
} from "../../src/common/constants/accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../../src/components/ui/button";
import { QrCode } from "../../src/common/components/QrCode";
import ConnectFarcasterAccountViaHatsProtocol from "../../src/common/components/ConnectFarcasterAccountViaHatsProtocol";
import { useAccount } from "wagmi";
import {
  WarpcastLoginStatus,
  createSignerRequest,
  generateWarpcastSigner,
  getWarpcastSignerStatus,
} from "../../src/common/helpers/warpcastLogin";
import HelpCard from "../../src/common/components/HelpCard";
import { useIsMounted } from "../../src/common/helpers/hooks";
import { useRouter } from "next/router";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { openWindow } from "../../src/common/helpers/navigation";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

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
};

const SignupSteps: SignupStepType[] = [
  {
    state: SignupStateEnum.initial,
    title: "Start adding Farcaster accounts",
    description: "Get started with herocast",
    idx: 0,
  },
  {
    state: SignupStateEnum.connecting,
    title: "Connect account",
    description: "Connect your Farcaster account to herocast",
    idx: 1,
  },
  {
    state: SignupStateEnum.done,
    title: "Start casting",
    description: "Start casting and browsing your feed",
    idx: 2,
  },
];

export default function Accounts() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected } = useAccount();
  const isMounted = useIsMounted();

  const { accounts, addAccount, setAccountActive } = useAccountStore();

  const { addNewPostDraft } = useNewPostStore();

  const hasActiveAccounts =
    accounts.filter(
      (account) =>
        account.status === AccountStatusType.active &&
        account.platform !== AccountPlatformType.farcaster_local_readonly
    ).length > 0;
  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster
  );
  const hasOnlyLocalAccounts = accounts.every(
    (account) =>
      account.platform === AccountPlatformType.farcaster_local_readonly
  );
  const hasPendingNewAccounts = pendingAccounts.length > 0;
  const pendingAccount = hasPendingNewAccounts ? pendingAccounts[0] : null;

  console.log("accounts", accounts, hasActiveAccounts);
  const [signupState, setSignupState] = useState<SignupStateEnum>(
    SignupStateEnum.initial
  );

  useEffect(() => {
    if (pendingAccount && signupState === SignupStateEnum.connecting) {
      pollForSigner();
    }
  }, [signupState, pendingAccount, isMounted]);

  useEffect(() => {
    if (hasPendingNewAccounts && signupState === SignupStateEnum.initial) {
      setSignupState(SignupStateEnum.connecting);
    }
  }, [signupState, hasPendingNewAccounts]);

  const onCreateNewAccount = async () => {
    const { publicKey, privateKey, signature, requestFid, deadline } =
      await generateWarpcastSigner();
    const { token, deeplinkUrl } = await createSignerRequest(
      publicKey,
      requestFid,
      signature,
      deadline
    );

    try {
      setIsLoading(true);
      await addAccount({
        account: {
          id: null,
          platformAccountId: undefined,
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster,
          publicKey,
          privateKey,
          data: { signerToken: token, deeplinkUrl },
        },
      });
      setIsLoading(false);
      setSignupState(1);
    } catch (e) {
      console.log("error when trying to add account", e);
      setIsLoading(false);
    }
  };

  const checkStatusAndActiveAccount = async (pendingAccount) => {
    const { status, data } = await getWarpcastSignerStatus(
      pendingAccount.data.signerToken
    );
    console.log("checked signer status: ", status, data);
    if (status === WarpcastLoginStatus.success) {
      const fid = data.userFid;
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (await neynarClient.lookupUserByFid(fid, APP_FID!)).result
        .user;
      await setAccountActive(pendingAccount.id, user.displayName, {
        platform_account_id: user.fid.toString(),
        data,
      });
      await hydrate();
      window.location.reload();
    }
  };

  const pollForSigner = async () => {
    let tries = 0;
    while (tries < 60) {
      tries += 1;
      await new Promise((r) => setTimeout(r, 2000));
      checkStatusAndActiveAccount(pendingAccount);

      if (!isMounted()) return;
    }
  };

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft);
    router.push("/post");
  };

  const renderSignupForNonLocalAccount = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex">
          You are using a readonly account <ArrowDownTrayIcon className="ml-2 mt-1 w-6 h-6" />
        </CardTitle>
        <CardDescription>
          A readonly account is great for browsing, but you need a full account
          to start casting and interact with others on Farcaster.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          className="w-full"
          variant="default"
          onClick={() => openWindow(`${process.env.NEXT_PUBLIC_URL}/login`)}
        >
          Switch to a full account
        </Button>
      </CardFooter>
    </Card>
  );

  const renderCreateSignerStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          Connect your Farcaster account
        </CardTitle>
        <CardDescription>
          Connect with herocast to see and publish casts
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          className="w-full"
          variant="default"
          onClick={() => onCreateNewAccount()}
        >
          <UserPlusIcon className="mr-1.5 h-5 w-5" aria-hidden="true" />
          {isLoading ? "Creating account..." : "Connect"}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderConnectAccountStep = () => {
    if (isEmpty(pendingAccounts)) return null;

    return (
      <div className="grid grid-cols-1 gap-4">
        <div className="h-fit">
          <Card className="bg-background text-foreground">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">
                Sign in with Ethereum wallet
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Pay with ETH on Optimism to connect with herocast
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>temporarily inactive - coming back soon</p>
              {/* {isConnected ? <ConfirmOnchainSignerButton account={pendingAccount} /> : <WalletLogin />} */}
            </CardContent>
            <CardFooter></CardFooter>
          </Card>
        </div>
        <div className="relative mx-4">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-sm text-foreground/80">
              OR
            </span>
          </div>
        </div>
        <Card className="bg-background text-foreground">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in with Warpcast</CardTitle>
            <CardDescription className="text-muted-foreground">
              Pay with Warps in Warpcast to connect with herocast
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span>
              Scan the QR code with your mobile camera app to sign in via
              Warpcast.
            </span>
            <QrCode
              deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`}
            />
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDoneStep = () => (
    <Card className="min-w-max bg-background text-foreground">
      <CardHeader className="space-y-1">
        <CardTitle className="flex">
          <CheckCircleIcon
            className="-mt-0.5 mr-1 h-5 w-5 text-foreground/80"
            aria-hidden="true"
          />
          Account added to herocast
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          You can start casting and browsing your feed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 -my-1.5 flex">
          <Button
            onClick={() => router.push("/feed")}
            type="button"
            variant="default"
          >
            Scroll your feed
            <NewspaperIcon
              className="ml-1.5 mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
          <Button
            onClick={() => onStartCasting()}
            type="button"
            variant="outline"
            className="ml-4"
          >
            Start casting
            <PlusCircleIcon
              className="ml-1.5 mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
          <Button
            onClick={() => router.push("/channels")}
            type="button"
            className="ml-4"
            variant="outline"
          >
            Pin your favourite channels
            <RectangleGroupIcon
              className="ml-1.5 mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="m-4 flex flex-col gap-5">
      {(hasActiveAccounts || signupState === SignupStateEnum.done) &&
        renderDoneStep()}
      <div className="w-2/3 flex flex-col gap-5">
        {hasOnlyLocalAccounts ? (
          <div className="flex w-full">{renderSignupForNonLocalAccount()}</div>
        ) : (
          <div className="flex w-full">
            {signupState === SignupStateEnum.initial &&
              renderCreateSignerStep()}
            {signupState === SignupStateEnum.connecting &&
              renderConnectAccountStep()}
            <ConnectFarcasterAccountViaHatsProtocol />
          </div>
        )}
        <HelpCard />
      </div>
    </div>
  );
}
