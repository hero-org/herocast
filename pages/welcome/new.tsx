import React, { useState } from "react";
import { UserPlusIcon } from "@heroicons/react/20/solid";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/common/constants/accounts";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { useAccountStore } from "@/stores/useAccountStore";
import { Button } from "@/components/ui/button";
import {
  generateWarpcastSigner,
  callCreateSignerRequest,
} from "@/common/helpers/warpcastLogin";
import { useRouter } from "next/router";

const CreateAccountPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { accounts, addAccount } = useAccountStore();
  const router = useRouter();

  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster,
  );

  const hasPendingNewAccounts = pendingAccounts.length > 0;

  const onCreateNewAccount = async () => {
    if (hasPendingNewAccounts) {
      router.push("/welcome/connect");
      return;
    }

    setIsLoading(true);
    try {
      const { publicKey, privateKey, signature, requestFid, deadline } =
        await generateWarpcastSigner();
      const { token, deeplinkUrl } = await callCreateSignerRequest({
        publicKey,
        requestFid,
        signature,
        deadline,
      });

      await addAccount({
        account: {
          id: null,
          platformAccountId: undefined,
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster,
          publicKey,
          privateKey,
          data: { signerToken: token, deeplinkUrl, deadline },
        },
      });
      // Artificial delay to ensure the account has the pending state before navigating
      await new Promise((resolve) => setTimeout(resolve, 2000));
      router.push("/welcome/connect");
    } catch (e) {
      console.error("Error when trying to add account", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col mt-24 items-center">
      <div className="space-y-6 p-10 pb-16 block text-center">
        <h2 className="text-4xl font-bold tracking-tight">
          Welcome to herocast
        </h2>
        <p className="text-lg text-muted-foreground">
          Build, engage and grow on Farcaster. Faster.
        </p>
        <div className="lg:max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardDescription>
                Connect your Farcaster account to Herocast to be able to see and
                publish casts
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full"
                variant="default"
                onClick={onCreateNewAccount}
              >
                <UserPlusIcon className="mr-1.5 h-5 w-5" aria-hidden="true" />
                {isLoading ? "Creating account..." : "Get Started"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateAccountPage;
