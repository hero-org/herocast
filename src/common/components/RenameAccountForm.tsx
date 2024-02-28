import React, { ReactNode, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  useAccount,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import {
  BUNDLER_ADDRESS,
  ViemWalletEip712Signer,
  bundlerABI,
  bytesToHexString,
  makeUserNameProofClaim,
} from "@farcaster/hub-web";
import { config, publicClient } from "@/common/helpers/rainbowkit";
import {
  WARPCAST_RECOVERY_PROXY,
  getDeadline,
  getFidForWallet,
  getSignedKeyRequestMetadataFromAppAccount,
  readNoncesFromKeyGateway,
  updateUsername,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { toBytes, toHex } from "viem";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { ExclamationCircleIcon } from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

export type RenameAccountFormValues = z.infer<typeof RenameAccountFormSchema>;

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
  const { address, isConnected } = useAccount();
  const currentName = account.name;
  const { signTypedDataAsync } = useSignTypedData();
  const wallet = useWalletClient();

  const form = useForm<RenameAccountFormValues>({
    resolver: zodResolver(RenameAccountFormSchema),
    mode: "onSubmit",
  });
  // const username = useWatch({ name: "username", control: form.control });
  const canSubmitForm = !isPending && isConnected;

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

  const validateConnectedWalletOwnsFid = async () => {
    if (!address) return;

    if (account.platform === AccountPlatformType.farcaster) {
      getFidForWallet(address).then(async (fid) => {
        if (fid === BigInt(account.platformAccountId!)) {
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

    if (!address) return;

    if (!validateUsername(data.username)) return;
    if (!validateConnectedWalletOwnsFid()) return;
    setIsPending(true);

    const timestamp = Math.floor(Date.now() / 1000);
    try {
      // const claim = makeUserNameProofClaim({
      //   name: data.username,
      //   owner: address,
      //   timestamp,
      // });
      // console.log("claim", claim);
      // const userSigner = new ViemWalletEip712Signer(wallet.data);
      // const rawSignature = await userSigner.signUserNameProofClaim(claim);
      // if (!rawSignature || rawSignature.isErr()) {
      //   console.log("rawSignature", rawSignature.error);
      //   throw new Error("Failed to sign username proof claim");
      // }
      // const signature = rawSignature._unsafeUnwrap();

      const claim = {
        name: data.username,
        owner: address,
        timestamp: BigInt(timestamp),
      };
      // console.log("userSigner", userSigner);
      console.log("claim", claim);
      // const rawSignature = await userSigner.signUserNameProofClaim(claim);
  
      const result = await signTypedDataAsync({
        domain: {
          name: "Farcaster name verification",
          version: "1",
          chainId: 1,
          verifyingContract:
            "0xe3be01d99baa8db9905b33a3ca391238234b79d1" as `0x${string}`,
        },
        types: {
          UserNameProof: [
            {
              name: "name",
              type: "string",
            },
            {
              name: "timestamp",
              type: "uint256",
            },
            {
              name: "owner",
              type: "address",
            },
          ],
        },
        primaryType: "UserNameProof" as const,
        message: claim,
      });
      console.log("res", result);
      const signature = toHex(result);

      await updateUsername(
        account.platformAccountId!,
        data.username,
        address,
        toHex(signature)
      );
    } catch (e) {
      console.error("renameAccount error", e);
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(renameAccount)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New username</FormLabel>
              <FormControl>
                <Input placeholder={currentName} {...field} />
              </FormControl>
              <FormDescription>
                This will be your new public username on Farcaster.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant={canSubmitForm ? "default" : "outline"} type="submit">
          Rename
        </Button>
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
      {(currentName !== 'New Account') && (
          <span>
            Your current username is <strong>{currentName}</strong>.<br />
          </span>
        )}
      {isConnected ? (
        renderForm()
      ) : (
        <div className="flex p-4 rounded-lg border border-gray-500 text-warning">
          <ExclamationCircleIcon className="h-5 w-5 mr-2 mt-.5" />
          <p className="text-foreground text-[15px] leading-normal">
            You need to connect your wallet to rename your account.
          </p>
        </div>
      )}
    </div>
  );
};

export default RenameAccountForm;
