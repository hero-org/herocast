import React, { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  PlusCircleIcon,
  RectangleGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, NewspaperIcon } from "@heroicons/react/24/solid";
import { useDraftStore } from "../../src/stores/useDraftStore";
import { JoinedHerocastPostDraft } from "@/common/constants/postDrafts";
import {
  AccountObjectType,
  hydrateAccounts,
  useAccountStore,
} from "../../src/stores/useAccountStore";
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
  callCreateSignerRequest,
  generateWarpcastSigner,
  getWarpcastSignerStatus,
} from "../../src/common/helpers/warpcastLogin";
import HelpCard from "../../src/common/components/HelpCard";
import { useIsMounted } from "../../src/common/helpers/hooks";
import { useRouter } from "next/router";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { openWindow } from "../../src/common/helpers/navigation";
import ConfirmOnchainSignerButton from "../../src/common/components/ConfirmOnchainSignerButton";
import SwitchWalletButton from "../../src/common/components/SwitchWalletButton";
import { getTimestamp } from "@/common/helpers/farcaster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

enum SignupStateEnum {
  "initial",
  "connecting",
  "done",
}

export default function Accounts() {
  const router = useRouter();
  const [signupState, setSignupState] = useState<SignupStateEnum>(
    SignupStateEnum.initial
  );
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected } = useAccount();
  const isMounted = useIsMounted();

  const { accounts, addAccount, setAccountActive, removeAccount } =
    useAccountStore();

  const { addNewPostDraft } = useDraftStore();

  const hasActiveAccounts =
    accounts.filter(
      (account) =>
        account.status === AccountStatusType.active &&
        account.platform !== AccountPlatformType.farcaster_local_readonly
    ).length > 0;
  const pendingAccounts =
    accounts.filter(
      (account) =>
        account.status === AccountStatusType.pending &&
        account.platform === AccountPlatformType.farcaster
    ) || [];
  const hasOnlyLocalAccounts =
    accounts.length &&
    accounts.every(
      (account) =>
        account.platform === AccountPlatformType.farcaster_local_readonly
    );
  const hasPendingNewAccounts = pendingAccounts.length > 0;
  const pendingAccount = hasPendingNewAccounts ? pendingAccounts[0] : null;

  useEffect(() => {
    if (pendingAccounts?.length && signupState === SignupStateEnum.connecting) {
      pendingAccounts.forEach((account) => pollForSigner(account.id));
    }
  }, [signupState, pendingAccounts, isMounted]);

  useEffect(() => {
    if (hasPendingNewAccounts && signupState === SignupStateEnum.initial) {
      setSignupState(SignupStateEnum.connecting);
    } else if (
      !hasPendingNewAccounts &&
      signupState === SignupStateEnum.connecting
    ) {
      setSignupState(SignupStateEnum.initial);
    }
  }, [signupState, hasPendingNewAccounts]);

  const onCreateNewAccount = async () => {
    const { publicKey, privateKey, signature, requestFid, deadline } =
      await generateWarpcastSigner();
    const { token, deeplinkUrl } = await callCreateSignerRequest({
      publicKey,
      requestFid,
      signature,
      deadline,
    });

    try {
      setIsLoading(true);
      await addAccount({
        account: {
          platformAccountId: undefined,
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster,
          publicKey,
          privateKey,
          data: { signerToken: token, deeplinkUrl, deadline },
        },
      });
      setIsLoading(false);
      setSignupState(SignupStateEnum.connecting);
    } catch (e) {
      console.log("error when trying to add account", e);
      setIsLoading(false);
      setSignupState(SignupStateEnum.initial);
    }
  };

  const checkStatusAndActiveAccount = async (
    pendingAccount: AccountObjectType
  ) => {
    if (!pendingAccount?.data?.signerToken) return;

    const deadline = pendingAccount.data?.deadline;
    if (deadline && getTimestamp() > deadline) {
      await removeAccount(pendingAccount.id);
      return;
    }

    const { status, data } = await getWarpcastSignerStatus(
      pendingAccount.data.signerToken
    );
    if (status === WarpcastLoginStatus.success) {
      const fid = data.userFid;
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (
        await neynarClient.fetchBulkUsers([fid], { viewerFid: APP_FID! })
      ).users[0];
      await setAccountActive(pendingAccount.id, user.username, {
        platform_account_id: user.fid.toString(),
        data,
      });
      await hydrateAccounts();
      window.location.reload();
    }
  };

  const pollForSigner = async (accountId: string) => {
    let tries = 0;
    while (tries < 60) {
      tries += 1;
      await new Promise((r) => setTimeout(r, 2000));

      const account = useAccountStore
        .getState()
        .accounts.find((account) => account.id === accountId);
      if (!account) return;

      await checkStatusAndActiveAccount(account);

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
          You are using a readonly account{" "}
          <ArrowDownTrayIcon className="ml-2 mt-1 w-6 h-6" />
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
          onClick={() =>
            openWindow(`${process.env.NEXT_PUBLIC_URL}/login?signupOnly=true`)
          }
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
            <CardTitle className="text-2xl">Sign in with Web3 wallet</CardTitle>
            <CardDescription className="text-muted-foreground">
              Pay with ETH on Optimism to connect with herocast
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <ConfirmOnchainSignerButton account={pendingAccount!} />
            ) : (
              <SwitchWalletButton />
            )}
          </CardContent>
          <CardFooter></CardFooter>
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
            onClick={() => router.push("/feeds")}
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

  const renderCreateNewOnchainAccountCard = () => (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">
          Create a new Farcaster account onchain
        </CardTitle>
        <CardDescription>
          No need to connect with Warpcast. Sign up directly with the Farcaster
          protocol onchain.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Button
            variant="default"
            onClick={() => router.push("/farcaster-signup")}
          >
            Create new account
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderFullAccountTabs = () => (
    <Tabs defaultValue="default">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="default">Add accounts</TabsTrigger>
          <TabsTrigger value="create">Create accounts</TabsTrigger>
          <TabsTrigger value="shared">Shared accounts</TabsTrigger>
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="default">
        <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
          <div className="max-w-md lg:max-w-lg">
            {signupState === SignupStateEnum.initial &&
              renderCreateSignerStep()}
            {signupState === SignupStateEnum.connecting &&
              renderConnectAccountStep()}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="create">
        <div className="flex flex-col max-w-md lg:max-w-lg gap-5">
          {renderCreateNewOnchainAccountCard()}
        </div>
      </TabsContent>
      <TabsContent value="shared">
        <div className="flex flex-col max-w-md lg:max-w-lg gap-5">
          <ConnectFarcasterAccountViaHatsProtocol />
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Create a shared Farcaster account
              </CardTitle>
              <CardDescription className="text-lg">
                Follow these steps to create a shared Farcaster account. Shared
                accounts are powered by Hats Protocol 🧢.
              </CardDescription>
            </CardHeader>
            <CardContent className="w-full max-w-lg"></CardContent>
            <CardFooter className="flex flex-col">
              <Button
                className="w-full"
                variant="default"
                onClick={() => router.push("/hats")}
              >
                Go to setup →
              </Button>
            </CardFooter>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="help">
        <div className="flex flex-col max-w-md lg:max-w-lg gap-5">
          <HelpCard />
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="pt-4 flex min-h-screen w-full flex-col bg-muted/40">
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        {hasOnlyLocalAccounts ? (
          <div className="flex">{renderSignupForNonLocalAccount()}</div>
        ) : (
          renderFullAccountTabs()
        )}
      </main>
    </div>
  );

  return (
    <div className="m-4 flex flex-col gap-5">
      <div className="w-full flex flex-col gap-5"></div>
    </div>
  );
}
