import React, { useEffect, useState } from "react";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/common/constants/accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { hydrate, useAccountStore } from "@/stores/useAccountStore";
import { useAccount } from "wagmi";
import ConfirmOnchainSignerButton from "@/common/components/ConfirmOnchainSignerButton";
import SwitchWalletButton from "@/common/components/SwitchWalletButton";
import { Separator } from "@/components/ui/separator";
import { QrCode } from "@/common/components/QrCode";

const ConnectAccountPage = () => {
  const { isConnected } = useAccount();
  const { accounts } = useAccountStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    hydrate();
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return null;
  }

  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster
  );

  if (pendingAccounts.length === 0) {
    return null;
  }

  const pendingAccount = pendingAccounts[0];

  return (
    <div className="mx-auto flex flex-col justify-center items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">
          Welcome to herocast
        </h2>
        <p className="text-lg text-muted-foreground">
          Build, engage and grow on Farcaster. Faster.
        </p>
        <div className="lg:max-w-lg mx-auto">
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-background text-foreground">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl">
                  Sign in with Warpcast
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <QrCode
                  deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`}
                />
              </CardContent>
            </Card>
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

            <Card className="bg-background text-foreground flex flex-col justify-center items-center">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl">
                  Sign in with Web3 wallet
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Pay with ETH on Optimism to connect with herocast
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isConnected ? (
                  <ConfirmOnchainSignerButton account={pendingAccount} />
                ) : (
                  <SwitchWalletButton />
                )}
              </CardContent>
              <CardFooter></CardFooter>
            </Card>
          </div>
        </div>
        <Separator className="my-6" />
      </div>
    </div>
  );
};

export default ConnectAccountPage;
