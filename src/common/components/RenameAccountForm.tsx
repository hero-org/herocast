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
  getSignedKeyRequestMetadataFromAppAccount,
  readNoncesFromKeyGateway,
  updateUsername,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { toBytes, toHex } from "viem";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { generateKeyPair } from "../helpers/warpcastLogin";
import { writeContract } from "@wagmi/core";
import ShowLinkCard from "./ShowLinkCard";
import debounce from "lodash.debounce";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { ExclamationCircleIcon } from "@heroicons/react/20/solid";

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

  const renameAccount = async (data) => {
    console.log("createFarcasterAccount", data);
    // alert(JSON.stringify(data, null, 2));

    if (!address) return;

    if (!validateUsername(data.username)) return;
    setIsPending(true);

    try {
      const claim = makeUserNameProofClaim({
        name: data.username,
        owner: address,
        timestamp: Math.floor(Date.now() / 1000),
      });
      console.log('claim', claim);
      const userSigner = new ViemWalletEip712Signer(wallet.data);
      const rawSignature = await userSigner.signUserNameProofClaim(claim);
      if (!rawSignature || rawSignature.isErr()) {
        console.log('rawSignature', rawSignature.error);
        throw new Error("Failed to sign username proof claim");     
      }
      const signature = rawSignature._unsafeUnwrap();
  
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
      <form
        onSubmit={form.handleSubmit(renameAccount)}
        className="space-y-8"
      >
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
        your account and import it into a custodial wallet. <br />
        {currentName && (
          <span>
            Your current username is <strong>{currentName}</strong>.<br />
          </span>
        )}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-y-4">
      {renderInfoBox()}
      {isConnected ? renderForm() : (
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
