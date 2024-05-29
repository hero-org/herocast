import React, { useEffect, useState } from "react";
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
import {
  useAccount,
  useSignTypedData,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import {
  getFidForAddress,
  getSignatureForUsernameProof,
  getTimestamp,
  setUserDataInProtocol,
  updateUsernameOffchain,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { getAddress, toHex } from "viem";
import {
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  hydrateAccounts,
  useAccountStore,
} from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { mainnet } from "viem/chains";
import { UserDataType } from "@farcaster/hub-web";
import { switchChain } from "viem/actions";
import { AccountSelector } from "./AccountSelector";

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
    if (!validateUsername(data.username)) return;

    setIsPending(true);
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
      throw new Error("Failed to get signature to register username");
    }

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
      UserDataType.DISPLAY,
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
                <Input
                  placeholder="Building x | Love to y | Find me at z"
                  {...field}
                />
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
            Register username
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
    <div className="w-3/4 lg:w-full space-y-4">
      <AccountSelector
        accountFilter={(account) =>
          account.status === "active" &&
          account.platform === AccountPlatformType.farcaster &&
          account.name === PENDING_ACCOUNT_NAME_PLACEHOLDER
        }
      />
      {renderForm()}
      {error && (
        <div className="flex flex-start items-center mt-2">
          <p className="text-wrap break-all	text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
};

export default RegisterFarcasterUsernameForm;
