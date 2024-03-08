import React, { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAccount,
  useWalletClient,
} from "wagmi";
import {
  UserDataType,
} from "@farcaster/hub-web";
import {
  getFidForAddress,
  getSignatureForUsernameProof,
  getTimestamp,
  getUsernameForFid,
  setUserDataInProtocol,
  updateUsername,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { getAddress } from "viem";
import { AccountObjectType, PENDING_ACCOUNT_NAME_PLACEHOLDER, useAccountStore } from "@/stores/useAccountStore";
import { AccountPlatformType } from "../constants/accounts";
import {
  Cog6ToothIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { mainnet } from "viem/chains";
import { switchChain } from "viem/actions";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v1";

export type RenameAccountFormValues = z.infer<typeof RenameAccountFormSchema>;

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const RenameAccountFormSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 1 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
});

const RenameAccountForm = ({
  account,
  onSuccess,
}: {
  onSuccess?: (data: RenameAccountFormValues) => void;
  account: AccountObjectType;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [userInProtocol, setUserInProtocol] = useState<User>();
  const { address, chainId, isConnected } = useAccount();
  const currentName = account.name;
  const { updateAccountUsername } = useAccountStore();
  const client = useWalletClient({
    account: address,
    chainId: mainnet.id,
  })?.data;

  const form = useForm<RenameAccountFormValues>({
    resolver: zodResolver(RenameAccountFormSchema),
    mode: "onSubmit",
  });
  const canSubmitForm = !isPending && isConnected && chainId === mainnet.id;

  useEffect(() => {
    const getUserInProtocol = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (
        await neynarClient.lookupUserByFid(
          Number(account.platformAccountId!),
          APP_FID!
        )
      ).result.user;
      setUserInProtocol(user);
    };

    if (account.platformAccountId) {
      getUserInProtocol();
    }
  }, [account.platformAccountId]);

  const validateUsername = async (username: string): Promise<boolean> => {
    const isValidNewUsername = await validateUsernameIsAvailable(username);
    if (!isValidNewUsername) {
      form.setError("username", {
        type: "manual",
        message: "Username is already taken",
      });
    }
    return isValidNewUsername;
  };

  const validateConnectedWalletOwnsFid = async (): Promise<
    boolean | undefined
  > => {
    if (!address) return undefined;

    if (account.platform === AccountPlatformType.farcaster) {
      getFidForAddress(address).then(async (fid) => {
        console.log("fid for wallet", fid, address, account.platformAccountId!);
        if (fid === BigInt(account.platformAccountId!)) {
          console.log("wallet owns fid");
          return true;
        } else {
          const neynarClient = new NeynarAPIClient(
            process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
          );
          const walletsResponse =
            await neynarClient.lookupCustodyAddressForUser(
              Number(account.platformAccountId)
            );
          const custodyAddress = walletsResponse?.result?.custodyAddress;
          const message = `Your connected wallet does not own the Farcaster account. Please connect with ${custodyAddress}. You are connected with ${address}`;
          console.log(message);
          form.setError("username", {
            type: "manual",
            message,
          });
          return false;
        }
      });
    } else if (
      account.platform === AccountPlatformType.farcaster_hats_protocol
    ) {
      // need to validate with the delegator contract address if wallet is a valid signer
      return true;
    }
  };

  const renameAccount = async (data) => {
    console.log("createFarcasterAccount", data);
    // alert(JSON.stringify(data, null, 2));

    if (!address || !client || !userInProtocol) return;

    const { username } = data;

    if (!(await validateUsername(username))) return;
    if (!(await validateConnectedWalletOwnsFid())) return;
    setIsPending(true);

    console.log("herocast account", account);
    console.log("userInProtocol", userInProtocol);
    let timestamp = getTimestamp();

    try {
      const owner = getAddress(address);
      const existingOffchainUsername = await getUsernameForFid(
        Number(account.platformAccountId!)
      );
      console.log("offchain username", existingOffchainUsername);
      if (existingOffchainUsername) {
        const unregisterSignature = await getSignatureForUsernameProof(
          client,
          address,
          {
            name: existingOffchainUsername,
            owner,
            timestamp: BigInt(timestamp),
          }
        );
        console.log("unregisterSignature:", unregisterSignature);
        if (!unregisterSignature) {
          throw new Error("Failed to get signature to unregister username");
        }
        // unregister old username
        await updateUsername({
          timestamp,
          owner,
          toFid: "0",
          fromFid: account.platformAccountId!,
          fid: account.platformAccountId!,
          username: existingOffchainUsername,
          signature: unregisterSignature,
        });

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      timestamp = getTimestamp();
      const registerSignature = await getSignatureForUsernameProof(
        client,
        address,
        {
          name: username,
          owner,
          timestamp: BigInt(timestamp),
        }
      );
      if (!registerSignature) {
        throw new Error("Failed to get signature to register username");
      }

      // register new username

      const result = await updateUsername({
        timestamp,
        owner,
        fromFid: "0",
        toFid: account.platformAccountId!,
        fid: account.platformAccountId!,
        username: username,
        signature: registerSignature,
      });
      console.log("updateUsername result", result);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await setUserDataInProtocol(
        account.privateKey!,
        Number(account.platformAccountId!),
        UserDataType.DISPLAY,
        username
      );
      updateAccountUsername(account.id!, username);
    } catch (e) {
      console.error("renameAccount error", e);
      form.setError("username", {
        type: "manual",
        message: `Error renaming account -> ${e}`,
      });
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(renameAccount)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New username</FormLabel>
              <FormControl>
                <Input placeholder={userInProtocol?.username} {...field} />
              </FormControl>
              {/* <FormDescription>
                This will be your new public username on Farcaster.
              </FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-sm text-muted-foreground">
          Renaming requires two signatures: one to unregister the old username
          and one to register the new username.
        </p>
        <Button
          disabled={!canSubmitForm}
          variant="default"
          type="submit"
          className="w-74"
        >
          {isPending && (
            <Cog6ToothIcon
              className="mr-2 h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          )}
          <p>Rename account</p>
        </Button>
        {chainId !== mainnet.id && (
          <Button
            variant="default"
            className="ml-4"
            onClick={() => switchChain(client!, { id: mainnet.id })}
          >
            Switch to mainnet
          </Button>
        )}
      </form>
    </Form>
  );

  const renderInfoBox = () => (
    <div className="bg-orange-400 dark:bg-orange-700 p-4 rounded-lg border border-gray-500">
      <p className="text-radix-mauve1 text-[15px] leading-normal">
        You can only rename your account if you are connected with your
        custodial wallet. If you signed up with Warpcast, you need to export
        your account and import it into a custodial wallet.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-y-4">
      {renderInfoBox()}
      {currentName !== PENDING_ACCOUNT_NAME_PLACEHOLDER && (
        <span>
          Your current username is <strong>{currentName}</strong>.<br />
        </span>
      )}
      {isConnected ? (
        renderForm()
      ) : (
        <div className="flex flex-row text-center items-center space-x-4">
          <div className="flex px-4 py-1.5 rounded-md bg-foreground/10 border border-gray-500 text-warning">
            <ExclamationCircleIcon className="h-4 w-4 mr-2 mt-1" />
            <p className="text-foreground text-[15px] leading-normal">
              Connect your wallet to rename your account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RenameAccountForm;
