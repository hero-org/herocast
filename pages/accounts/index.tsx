import React, { useEffect, useState } from "react";
import WalletLogin from "../../src/common/components/WalletLogin";
import { CheckCircleIcon, PlusCircleIcon, RectangleGroupIcon, UserPlusIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/24/solid";
import { JoinedHerocastPostDraft, useNewPostStore } from "../../src/stores/useNewPostStore";
import { hydrate, useAccountStore } from "../../src/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { AccountPlatformType, AccountStatusType } from "../../src/common/constants/accounts";
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
import { useAccount } from "wagmi";
import ConfirmOnchainSignerButton from "../../src//common/components/ConfirmOnchainSignerButton";
import { WarpcastLoginStatus, createSignerRequest, generateWarpcastSigner, getWarpcastSignerStatus } from "../../src/common/helpers/warpcastLogin";
import { getUserInfoByFid } from "../../src/common/helpers/neynar";
import HelpCard from "../../src/common/components/HelpCard";
import { useIsMounted } from "../../src/common/helpers/hooks";
import { useRouter } from "next/router";
import ConnectFarcasterAccountViaHatsProtocol from "../../src/common/components/HatsProtocol/ConnectFarcasterAccountViaHatsProtocol";

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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected } = useAccount();
  const isMounted = useIsMounted();

  const {
    accounts,
    addAccount,
    setAccountActive,
  } = useAccountStore();

  const {
    addNewPostDraft,
  } = useNewPostStore();

  const hasActiveAccounts = accounts.filter((account) => account.status === AccountStatusType.active).length > 0;
  const pendingAccounts = accounts.filter((account) => account.status === AccountStatusType.pending);
  const hasPendingNewAccounts = pendingAccounts.length > 0;
  const pendingAccount = hasPendingNewAccounts ? pendingAccounts[0] : null;

  const [signupStateIdx, setSignupStateIdx] = useState(0);
  const signupState = SignupSteps[signupStateIdx];

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft)
    router.push('/post');
  }

  useEffect(() => {
    if (hasPendingNewAccounts && signupState.state === SignupStateEnum.initial) {
      setSignupStateIdx(1);
    }
  }, [signupStateIdx, hasPendingNewAccounts]);

  const onCreateNewAccount = async () => {
    const { publicKey, privateKey, signature, requestFid, deadline } = await generateWarpcastSigner();
    const { token, deeplinkUrl } = await createSignerRequest(publicKey, requestFid, signature, deadline);

    try {
      setIsLoading(true);
      addAccount({
        id: null,
        platformAccountId: undefined,
        status: AccountStatusType.pending,
        platform: AccountPlatformType.farcaster,
        publicKey,
        privateKey,
        data: { signerToken: token, deeplinkUrl }
      });
      setIsLoading(false);
      setSignupStateIdx(1);

    } catch (e) {
      console.log('error when trying to add account', e);
      setIsLoading(false);
    }
  }

  const pollForSigner = async () => {
    let tries = 0;
    while (tries < 60) {
      tries += 1;
      await new Promise((r) => setTimeout(r, 2000));

      const { status, data } = await getWarpcastSignerStatus(pendingAccount.data.signerToken);
      console.log('signerStatus: ', status, data);
      if (status === WarpcastLoginStatus.success) {
        const fid = data.userFid;
        const userInfo = await getUserInfoByFid(fid);
        setAccountActive(pendingAccount.id, userInfo?.displayName, { platform_account_id: data.userFid, data });
        await hydrate();
        window.location.reload();
      }

      if (!isMounted()) return;
    }
  }

  useEffect(() => {
    if (pendingAccount && signupState.state === SignupStateEnum.connecting) {
      pollForSigner();
    }
  }, [signupState, pendingAccount, isMounted]);

  const renderCreateSignerStep = () => (
    <Card className="bg-background text-foreground">
      <CardHeader>
        <CardTitle className="text-2xl">Connect your Farcaster account</CardTitle>
        <CardDescription>Connect with herocast to see and publish casts</CardDescription>
      </CardHeader>
      {/* <CardContent>
        <p>Card Content</p>
      </CardContent> */}
      <CardFooter>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => onCreateNewAccount()}
        >
          <UserPlusIcon className="mr-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
          {isLoading ? 'Creating account...' : 'Connect'}
        </Button>
      </CardFooter>
    </Card>
  )

  const renderConnectAccountStep = () => {
    if (isEmpty(pendingAccounts)) return null;

    return (
      <div className="grid grid-cols-1 gap-4">
        <div className="h-fit">
          <Card className="bg-background text-foreground">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign in with Ethereum wallet</CardTitle>
              <CardDescription className="text-muted-foreground">Pay with ETH on Optimism to connect with herocast</CardDescription>
            </CardHeader>
            <CardContent>
              {isConnected ? <ConfirmOnchainSignerButton account={pendingAccount} /> : <WalletLogin />}
            </CardContent>
            <CardFooter>
            </CardFooter>
          </Card>
        </div>
        <div className="relative mx-4">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-800 px-2 text-sm text-gray-500">OR</span>
          </div>
        </div>
        <Card className="bg-background text-foreground">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in with Warpcast</CardTitle>
            <CardDescription className="text-muted-foreground">Pay with Fiat in Warpcast to connect with herocast</CardDescription>
          </CardHeader>
          <CardContent>
            Scan the QR code with your mobile camera app to sign in via Warpcast
            <QrCode deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderDoneStep = () => (
    <Card className="min-w-max bg-background text-foreground">
      <CardHeader className="space-y-1">
        <CardTitle className="flex">
          <CheckCircleIcon className="-mt-0.5 mr-1 h-5 w-5 text-gray-500" aria-hidden="true" />
          Account added to herocast</CardTitle>
        <CardDescription className="text-muted-foreground">You can start casting and browsing your feed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 -my-1.5 flex">
          <Button
            onClick={() => onStartCasting()}
            type="button"
            className="flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            Start casting
            <PlusCircleIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
          </Button>
          <Button
            onClick={() => router.push('/feed')}
            type="button"
            className="ml-4 flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            Scroll your feed
            <NewspaperIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
          </Button>
          <Button
            onClick={() => router.push('/channels')}
            type="button"
            className="ml-4 flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            Pin your favourite channels
            <RectangleGroupIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="m-4 flex flex-col gap-5">
      <div>
        <div className="flex w-full max-w-3xl">
          {signupState.state === SignupStateEnum.initial && renderCreateSignerStep()}
          {signupState.state === SignupStateEnum.connecting && renderConnectAccountStep()}
          {hasActiveAccounts || signupState.state === SignupStateEnum.done && renderDoneStep()}
        </div>
      </div>
      <ConnectFarcasterAccountViaHatsProtocol />
      <HelpCard />
      {/* 
      <Button className="mt-12" onClick={() => setSignupStateIdx(signupState.idx + 1)} disabled={!hasActiveAccounts}>
        next
      </Button>
      <Button onClick={() => setSignupStateIdx(0)} disabled={!hasActiveAccounts}>
        reset
      </Button>
      <ConnectButton /> 
      */}
    </div>
  )
}
