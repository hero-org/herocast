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
import { useAccount, useSignTypedData, useWalletClient } from "wagmi";
import {
  getFidForAddress,
  getSignatureForUsernameProof,
  getTimestamp,
  setUserDataInProtocol,
  updateUsername,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { getAddress, toHex } from "viem";
import {
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  useAccountStore,
} from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { mainnet } from "viem/chains";
import { UserDataType } from "@farcaster/hub-web";
import { switchChain } from "viem/actions";

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
  const [fid, setFid] = useState<bigint | null>();
  const [error, setError] = useState<string | null>();
  const { address, chainId, isConnected } = useAccount();
  const client = useWalletClient({
    account: address,
    chainId: mainnet.id,
  })?.data;
  const form = useForm<FarcasterAccountSetupFormValues>({
    resolver: zodResolver(FarcasterAccountSetupFormSchema),
    defaultValues: { username: "", displayName: "", bio: "" },
  });
  const { accounts, updateAccountUsername } = useAccountStore();
  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.active &&
      account.platform === AccountPlatformType.farcaster &&
      account.name === PENDING_ACCOUNT_NAME_PLACEHOLDER
  );

  const canSubmitForm = !isPending && isConnected && chainId === mainnet.id;

  useEffect(() => {
    getFidForAddress(address!)
      .then(setFid)
      .catch((e) => setError(e.message));
  }, [address]);

  useEffect(() => {
    if (pendingAccounts.length === 0) {
      setError("No pending accounts found");
    } else {
      setError(null);
    }
  }, [pendingAccounts]);

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
    console.log("createFarcasterAccount", data);

    if (!address || !fid) return;
    if (!validateUsername(data.username)) return;

    const account = pendingAccounts.filter(
      (account) => account.platformAccountId === String(fid!)
    )?.[0];
    if (!account) {
      setError("No pending account found");
      return;
    }
    console.log("account", account);

    setIsPending(true);
    const owner = getAddress(address);
    const { username, bio } = data;
    console.log("RegusterFarcasterAccount", data);
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

    const result = await updateUsername({
      timestamp,
      owner,
      fromFid: "0",
      toFid: fid.toString(),
      fid: fid.toString(),
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
              variant="default"
              onClick={() => switchChain(client!, { id: mainnet.id })}
            >
              Switch to mainnet
            </Button>
          )}
        </div>
      </form>
    </Form>
  );

  return (
    <div className="w-2/3">
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
