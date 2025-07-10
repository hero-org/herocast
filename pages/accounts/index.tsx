import React, { useEffect, useState } from 'react';
import { UserPlusIcon } from '@heroicons/react/20/solid';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import {
  AccountObjectType,
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  hydrateAccounts,
  useAccountStore,
} from '@/stores/useAccountStore';
import isEmpty from 'lodash.isempty';
import { AccountPlatformType, AccountStatusType } from '@/common/constants/accounts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/common/components/QrCode';
import { useAccount } from 'wagmi';
import {
  WarpcastLoginStatus,
  callCreateSignerRequest,
  generateWarpcastSigner,
  getWarpcastSignerStatus,
} from '@/common/helpers/warpcastLogin';
import HelpCard from '@/common/components/HelpCard';
import { useIsMounted } from '@/common/helpers/hooks';
import { useRouter } from 'next/router';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { openWindow } from '@/common/helpers/navigation';
import ConfirmOnchainSignerButton from '@/common/components/ConfirmOnchainSignerButton';
import SwitchWalletButton from '@/common/components/SwitchWalletButton';
import { getTimestamp } from '@/common/helpers/farcaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AlertDialogDemo from '@/common/components/AlertDialog';
import AccountManagementModal from '@/common/components/AccountManagement/AccountManagementModal';
import { cn } from '@/lib/utils';
import { filter } from 'lodash';
import SortableList, { SortableItem } from 'react-easy-sort';
import { Badge } from '@/components/ui/badge';

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

enum SignupStateEnum {
  'initial',
  'connecting',
  'done',
}

export default function Accounts() {
  const router = useRouter();
  const [signupState, setSignupState] = useState<SignupStateEnum>(SignupStateEnum.initial);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected } = useAccount();
  const isMounted = useIsMounted();
  const [selectedAccount, setSelectedAccount] = useState<AccountObjectType>();

  const { accounts, addAccount, setAccountActive, removeAccount, updateAccountUsername, updateAccountDisplayOrder } =
    useAccountStore();

  const pendingAccounts =
    accounts.filter(
      (account) => account.status === AccountStatusType.pending && account.platform === AccountPlatformType.farcaster
    ) || [];
  const hasOnlyLocalAccounts =
    accounts.length && accounts.every((account) => account.platform === AccountPlatformType.farcaster_local_readonly);
  const hasPendingNewAccounts = pendingAccounts.length > 0;
  const pendingAccount = hasPendingNewAccounts ? pendingAccounts[0] : null;

  useEffect(() => {
    if (pendingAccounts?.length && signupState === SignupStateEnum.connecting) {
      pendingAccounts.forEach((account) => pollForSigner(account.id));
    }
  }, [signupState, pendingAccounts, isMounted()]);

  useEffect(() => {
    if (hasPendingNewAccounts && signupState === SignupStateEnum.initial) {
      setSignupState(SignupStateEnum.connecting);
    } else if (!hasPendingNewAccounts && signupState === SignupStateEnum.connecting) {
      setSignupState(SignupStateEnum.initial);
    }
  }, [signupState, hasPendingNewAccounts]);

  const onClickManageAccount = (account: AccountObjectType) => {
    setSelectedAccount(account);
    setModalOpen(true);
  };

  const refreshAccountNames = async () => {
    setIsLoading(true);
    await Promise.all(accounts.map(async (account) => await updateAccountUsername(account.id)))
      .then(async () => {
        console.log('All account names refreshed successfully');
        await hydrateAccounts();
      })
      .catch((error) => console.error('Error refreshing account names:', error));
    setIsLoading(false);
  };

  const onSortEnd = (oldIndex: number, newIndex: number) => {
    if (oldIndex !== newIndex) {
      updateAccountDisplayOrder({ oldIndex, newIndex });
    }
  };

  const onCreateNewAccount = async () => {
    const { publicKey, privateKey, signature, requestFid, deadline } = await generateWarpcastSigner();
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
      console.log('error when trying to add account', e);
      setIsLoading(false);
      setSignupState(SignupStateEnum.initial);
    }
  };

  const checkStatusAndActiveAccount = async (pendingAccount: AccountObjectType) => {
    if (!pendingAccount?.data?.signerToken) return;

    const deadline = pendingAccount.data?.deadline;
    if (deadline && getTimestamp() > deadline) {
      await removeAccount(pendingAccount.id);
      return;
    }

    const { status, data } = await getWarpcastSignerStatus(pendingAccount.data.signerToken);
    if (status === WarpcastLoginStatus.success) {
      const fid = data.userFid;
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
      const user = (await neynarClient.fetchBulkUsers([fid], { viewerFid: APP_FID! })).users[0];
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

      const account = useAccountStore.getState().accounts.find((account) => account.id === accountId);
      if (!account) return;

      await checkStatusAndActiveAccount(account);

      if (!isMounted()) return;
    }
  };

  const renderSignupForNonLocalAccount = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex">
          You are using a readonly account <ArrowDownTrayIcon className="ml-2 mt-1 w-6 h-6" />
        </CardTitle>
        <CardDescription>
          A readonly account is great for browsing, but you need a full account to start casting and interact with
          others on Farcaster.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          className="w-full"
          variant="default"
          onClick={() => openWindow(`${process.env.NEXT_PUBLIC_URL}/login?signupOnly=true`)}
        >
          Switch to a full account
        </Button>
      </CardFooter>
    </Card>
  );

  const renderCreateSignerStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Connect your Farcaster account</CardTitle>
        <CardDescription>Connect with herocast to see and publish casts</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button className="w-full" variant="default" onClick={() => onCreateNewAccount()}>
          <UserPlusIcon className="mr-1.5 h-5 w-5" aria-hidden="true" />
          {isLoading ? 'Connecting...' : 'Connect Account'}
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
              <span>Scan the QR code with your mobile camera app to sign in via Warpcast.</span>
              <QrCode
                deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`}
              />
            </CardContent>
          </Card>
        </div>
        <div className="relative mx-4">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-sm text-foreground/80">OR</span>
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
            {isConnected ? <ConfirmOnchainSignerButton account={pendingAccount!} /> : <SwitchWalletButton />}
          </CardContent>
          <CardFooter></CardFooter>
        </Card>
      </div>
    );
  };

  const renderCreateNewOnchainAccountCard = () => (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create a new Farcaster account onchain</CardTitle>
        <CardDescription>
          No need to connect with Farcaster app. Sign up directly with the Farcaster protocol onchain.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Button variant="default" onClick={() => router.push('/farcaster-signup')}>
            Create new account
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderActiveAccountsOverview = () => {
    const activeAccounts = filter(accounts, (account) => account.status === 'active');

    if (isEmpty(activeAccounts)) return null;

    return (
      <>
        <div className="flex justify-between pb-2 border-b border-gray-200">
          <h1 className="text-xl font-semibold leading-7 text-foreground/80">Connected Farcaster accounts</h1>
        </div>
        <ul role="list" className="mb-8 divide-y">
          {activeAccounts.map((item: AccountObjectType) => (
            <li key={item.id} className="px-2 py-2">
              <div className="flex items-center gap-x-3">
                <h3 className="text-foreground/80 flex-auto truncate text-sm font-semibold leading-6">
                  {item.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
                </h3>
                <p className="truncate text-sm text-foreground/80">{item.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  };

  const renderUnifiedAccountsPage = () => {
    const activeAccounts = filter(accounts, (account) => account.status === 'active');
    const hasMultipleAccounts = accounts.length > 1;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with actions */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Farcaster Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {accounts.length === 0
                ? 'Connect your Farcaster account to start casting'
                : hasMultipleAccounts
                  ? 'Drag to reorder accounts and update hotkey assignments'
                  : 'Connect more accounts to switch between them with hotkeys'}
            </p>
          </div>
          {accounts.length > 0 && (
            <Button variant="outline" size="sm" disabled={isLoading} onClick={() => refreshAccountNames()}>
              <ArrowPathIcon className={cn(isLoading && 'animate-spin', 'mr-2 h-4 w-4')} />
              Refresh
            </Button>
          )}
        </div>

        {/* Main content area */}
        <div className="space-y-6">
          {/* Connect account button - always visible at top */}
          {accounts.length > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={() => onCreateNewAccount()}
                disabled={isLoading || signupState === SignupStateEnum.connecting}
              >
                <UserPlusIcon className="mr-2 h-4 w-4" />
                Connect Account
              </Button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column: Existing accounts or empty state */}
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <UserPlusIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No accounts connected</h3>
                    <p className="text-sm text-muted-foreground">Connect your first Farcaster account to get started</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    Your Accounts
                    <Badge variant="secondary">{accounts.length}</Badge>
                  </h2>
                  <SortableList onSortEnd={onSortEnd} className="space-y-2" draggedItemClassName="opacity-50">
                    {accounts.map((item: AccountObjectType, idx: number) => (
                      <SortableItem key={item.id}>
                        <div className="rounded-lg border bg-card p-4 cursor-move hover:bg-accent/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Drag handle */}
                              {hasMultipleAccounts && (
                                <div className="text-muted-foreground">
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <circle cx="4" cy="4" r="1.5" />
                                    <circle cx="12" cy="4" r="1.5" />
                                    <circle cx="4" cy="8" r="1.5" />
                                    <circle cx="12" cy="8" r="1.5" />
                                    <circle cx="4" cy="12" r="1.5" />
                                    <circle cx="12" cy="12" r="1.5" />
                                  </svg>
                                </div>
                              )}

                              {/* Account info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">
                                  {item.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>FID: {item.platformAccountId || 'Pending'}</span>
                                  {idx < 9 && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono text-xs">Ctrl+{idx + 1}</span>
                                    </>
                                  )}
                                  {item.status !== 'active' && <span className="text-yellow-600">• {item.status}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                              {item.status === 'active' && (
                                <Button variant="ghost" size="sm" onClick={() => onClickManageAccount(item)}>
                                  Manage
                                </Button>
                              )}
                              <AlertDialogDemo buttonText="Remove" onClick={() => removeAccount(item.id)} />
                            </div>
                          </div>
                        </div>
                      </SortableItem>
                    ))}
                  </SortableList>
                </>
              )}
            </div>

            {/* Right column: Connect account options */}
            <div className="space-y-4">
              {/* Show connection flow or options based on state */}
              {signupState === SignupStateEnum.initial ? (
                <>
                  <h2 className="text-lg font-semibold">Connect Account</h2>

                  {/* Connect with Warpcast - Primary CTA */}
                  <Card className={accounts.length === 0 ? 'border-primary' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg">Connect with Farcaster</CardTitle>
                      <CardDescription>Connect your existing Farcaster account via Warpcast</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        variant={accounts.length === 0 ? 'default' : 'outline'}
                        onClick={() => onCreateNewAccount()}
                        disabled={isLoading}
                      >
                        <UserPlusIcon className="mr-2 h-4 w-4" />
                        {isLoading ? 'Connecting...' : 'Connect Account'}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Create new account option */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">New to Farcaster?</CardTitle>
                      <CardDescription>Create a brand new Farcaster account directly onchain</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" onClick={() => router.push('/farcaster-signup')}>
                        Create New Account
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : (
                /* Connecting state */
                <>
                  <h2 className="text-lg font-semibold">Complete Connection</h2>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Scan QR Code</CardTitle>
                      <CardDescription>Scan with Warpcast or pay with ETH to connect</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <QrCode
                          deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`}
                        />
                        <p className="text-sm text-muted-foreground mt-2">Scan with your mobile camera</p>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Or</span>
                        </div>
                      </div>

                      <div>
                        {isConnected ? <ConfirmOnchainSignerButton account={pendingAccount} /> : <SwitchWalletButton />}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Help section */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                </CardHeader>
                <CardContent>
                  <HelpCard />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-muted/40 overflow-y-auto">
      <main className="p-4 sm:px-6 sm:py-6 pb-12">
        {hasOnlyLocalAccounts ? (
          <div className="flex max-w-4xl mx-auto">{renderSignupForNonLocalAccount()}</div>
        ) : (
          renderUnifiedAccountsPage()
        )}
      </main>
      <AccountManagementModal account={selectedAccount} open={isModalOpen} setOpen={setModalOpen} />
    </div>
  );
}
