// Unit #9 (#754 auth/accounts) — the connect-account onboarding step, ported from
// app/(auth)/welcome/connect/page.tsx. Mounted OUTSIDE the `_app` shell by
// routes/welcome.connect.tsx (the Next `(auth)` group has no app chrome).
//
// Surgical changes vs. the Next source (everything else byte-identical):
//   C1  `next/navigation` → `@/web/lib/navigation`
//   C3  `'use client'` removed
//
// SSR-safety: `/welcome/connect` is a wallet route (unit-#3 WALLET_ROUTES), so
// `WalletProviders` is null on the server → this page never renders during SSR; `useAccount()`
// (wagmi) runs client-only. `Number(process.env.NEXT_PUBLIC_APP_FID!)` is allowlisted (#4).
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import ConfirmOnchainSignerButton from '@/common/components/ConfirmOnchainSignerButton';
import { QrCode } from '@/common/components/QrCode';
import SwitchWalletButton from '@/common/components/SwitchWalletButton';
import { AccountPlatformType, AccountStatusType } from '@/common/constants/accounts';
import { getTimestamp } from '@/common/helpers/farcaster';
import { useIsMounted } from '@/common/helpers/hooks';
import { getWarpcastSignerStatus, WarpcastLoginStatus } from '@/common/helpers/warpcastLogin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getProvider } from '@/lib/farcaster/providers';
import { type AccountObjectType, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { useRouter } from '@/web/lib/navigation';

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const ConnectAccountPage = () => {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { accounts, removeAccount, setAccountActive } = useAccountStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const isMounted = useIsMounted();

  useEffect(() => {
    hydrateAccounts();
    setIsHydrated(true);
  }, []);

  const pendingAccounts = accounts.filter(
    (account) => account.status === AccountStatusType.pending && account.platform === AccountPlatformType.farcaster
  );
  const pendingAccount = pendingAccounts?.[0];

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
      const users = await getProvider().getBulkUsers({ fids: [fid], viewerFid: APP_FID });
      const user = users[0];
      await setAccountActive(pendingAccount.id, user.username, {
        platform_account_id: user.fid.toString(),
        data,
      });
      await hydrateAccounts();
      router.push('/welcome/success');
    }
  };

  const pollForSigner = async (accountId: string) => {
    let tries = 0;
    while (tries < 60) {
      tries += 1;
      await new Promise((r) => setTimeout(r, 2000));

      const account = useAccountStore.getState().accounts.find((account) => account.id === accountId);
      if (!account) return;
      if (!isMounted()) return;

      await checkStatusAndActiveAccount(account);
    }
  };

  useEffect(() => {
    if (pendingAccount) {
      pendingAccounts.forEach((account) => pollForSigner(account.id));
    }
  }, [pendingAccount]);

  if (!isHydrated) {
    return null;
  }

  if (pendingAccounts.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto flex flex-col justify-center items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">Welcome to herocast</h2>
        <p className="text-lg text-muted-foreground">Build, engage and grow on Farcaster. Faster.</p>
        <div className="lg:max-w-lg mx-auto">
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-background text-foreground">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl">Sign in with Warpcast</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <QrCode
                  deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`}
                />
              </CardContent>
            </Card>
            <div className="relative mx-4">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-sm text-foreground/80">OR</span>
              </div>
            </div>

            <Card className="bg-background text-foreground flex flex-col justify-center items-center">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl">Sign in with Web3 wallet</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Pay with ETH on Optimism to connect with herocast
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isConnected ? <ConfirmOnchainSignerButton account={pendingAccount} /> : <SwitchWalletButton />}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectAccountPage;
