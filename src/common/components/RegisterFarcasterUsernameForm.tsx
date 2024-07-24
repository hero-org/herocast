import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import {
  getSignatureForUsernameProof,
  getTimestamp,
  setUserDataInProtocol,
  updateUsernameOffchain,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { getAddress } from "viem";
import {
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  hydrateAccounts,
  useAccountStore,
} from "@/stores/useAccountStore";
import { AccountPlatformType } from "../constants/accounts";
import { mainnet } from "viem/chains";
import { validations, UserDataType } from "@farcaster/hub-web";
import { AccountSelector } from "./AccountSelector";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";

export type FarcasterAccountSetupFormValues = z.infer<
  typeof FarcasterAccountSetupFormSchema
>;

const FarcasterAccountSetupFormSchema = z.object({
  username: z.string().min(5, {
    message: "Username must be at least 5 characters",
  }),
  displayName: z
    .union([
      z.string().length(0),
      z
        .string()
        .min(4, {
          message: "Display name must be at least 4 characters.",
        })
        .max(20, {
          message: "Display name must not be longer than 20 characters.",
        }),
    ])
    .optional()
    .transform((e) => (e === "" ? undefined : e)),
  bio: z
    .union([
      z.string().length(0),
      z
        .string()
        .min(4, {
          message: "Bio must be at least 4 characters.",
        })
        .max(160, {
          message: "Bio must not be longer than 20 characters.",
        }),
    ])
    .optional()
    .transform((e) => (e === "" ? undefined : e)),
});

const RegisterFarcasterUsernameForm = ({
  onSuccess,
}: {
  onSuccess: (data: FarcasterAccountSetupFormValues) => void;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>();
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = useWalletClient({
    account: address,
    chainId: mainnet.id,
  })?.data;
  const form = useForm<FarcasterAccountSetupFormValues>({
    resolver: zodResolver(FarcasterAccountSetupFormSchema),
    defaultValues: { username: "", displayName: "", bio: "" },
  });
  const { updateAccountUsername } = useAccountStore();
  const account = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const canSubmitForm = !isPending && isConnected && chainId === mainnet.id;

  const validateUsername = async (username: string): Promise<boolean> => {
    const validationResults = validations.validateFname(username);
    if (validationResults.isErr()) {
      form.setError("username", {
        type: "manual",
        message: validationResults.error.message,
      });
      return false;
    }
    const isValidNewUsername = await validateUsernameIsAvailable(username);
    if (!isValidNewUsername) {
      form.setError("username", {
        type: "manual",
        message: "Username is already taken",
      });
    }
    return isValidNewUsername;
  };

  const registerFarcasterUsername = async (
    data: z.infer<typeof FarcasterAccountSetupFormSchema>
  ) => {
    console.log("registerFarcasterUsername", data);

    if (!address) {
      form.setError("username", {
        type: "manual",
        message: "Connect your wallet to continue",
      });
      return;
    }
    if (!(await validateUsername(data.username))) return;

    setIsPending(true);
    setError(null);

    try {
      const owner = getAddress(address);
      const { username, bio } = data;

      let displayName = data.displayName;
      if (!displayName) {
        displayName = username;
      }

      const timestamp = getTimestamp();
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
        setIsPending(false);
        throw new Error("Failed to get signature to register username");
      }

      // todo: fix this can happen if account.getPlatformAccountId() is not set

      // register new username
      const result = await updateUsernameOffchain({
        timestamp,
        owner,
        fromFid: "0",
        toFid: account.platformAccountId!.toString(),
        fid: account.platformAccountId!.toString(),
        username: username,
        signature: registerSignature,
      });
      console.log("updateUsername result", result);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await setUserDataInProtocol(
        account.privateKey!,
        Number(account.platformAccountId!),
        UserDataType.USERNAME,
        username
      );
      updateAccountUsername(account.id);

      await setUserDataInProtocol(
        account.privateKey!,
        Number(account.platformAccountId!),
        UserDataType.DISPLAY,
        displayName
      );

      if (bio) {
        await setUserDataInProtocol(
          account.privateKey!,
          Number(account.platformAccountId!),
          UserDataType.BIO,
          bio
        );
      }

      await hydrateAccounts();
      onSuccess?.(data);
    } catch (e) {
      console.error("Failed to register username", e);
      setError("Failed to register username");
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(registerFarcasterUsername)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="hellyes" {...field} />
              </FormControl>
              <FormDescription>
                This will be your public username. It can be your real name or a
                pseudonym.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="hellyes123" {...field} />
              </FormControl>
              <FormDescription>
                This will be your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Input placeholder="building x and love to y" {...field} />
              </FormControl>
              <FormDescription>
                This will be your public bio / account description.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col space-y-2">
          <Button disabled={!canSubmitForm} type="submit">
            {isPending && (
              <Cog6ToothIcon
                className="mr-2 h-5 w-5 animate-spin"
                aria-hidden="true"
              />
            )}
            Register username
          </Button>
          <Button
            variant="outline"
            disabled={!canSubmitForm}
            onClick={() => hydrateAccounts()}
          >
            Refresh
          </Button>
          {chainId !== mainnet.id && (
            <Button
              type="button"
              variant="default"
              onClick={() => switchChainAsync({ chainId: mainnet.id })}
            >
              Switch to mainnet
            </Button>
          )}
        </div>
      </form>
    </Form>
  );

  return (
    <div className="w-full space-y-4">
      <AccountSelector
        accountFilter={(account) =>
          account.status === "active" &&
          account.platform === AccountPlatformType.farcaster &&
          (!account.name || account.name === PENDING_ACCOUNT_NAME_PLACEHOLDER)
        }
      />
      {account && renderForm()}
      {error && (
        <div className="flex flex-start items-center mt-2">
          <p className="text-wrap break-all	text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
};

export default RegisterFarcasterUsernameForm;
