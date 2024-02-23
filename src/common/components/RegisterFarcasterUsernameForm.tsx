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
import { useAccount, useConnectorClient, useSignTypedData } from "wagmi";
import {
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  makeUserNameProofClaim,
} from "@farcaster/hub-web";
import { wagmiConfig } from "@/common/helpers/rainbowkit";
import { validateUsernameIsAvailable } from "../helpers/farcaster";
import { isAddress, toHex } from "viem";
import {
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  useAccountStore,
} from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";

export type FarcasterAccountSetupFormValues = z.infer<
  typeof FarcasterAccountSetupFormSchema
>;

const USERNAME_PROOF_EIP_712_TYPES = {
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
};

const FarcasterAccountSetupFormSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 1 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
  // displayName: z.string().min(5, {
  //   message: "Display name must be at least 5 characters",
  // }),
  // bio: z.string().max(160).min(4),
});

const RegisterFarcasterUsernameForm = ({
  onSuccess,
}: {
  onSuccess: (data: FarcasterAccountSetupFormValues) => void;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>();
  const { address, isConnected } = useAccount();
  // const walletClient = useWalletClient({
  //   account: address,
  // });
  const { signTypedDataAsync } = useSignTypedData();
  // const { data: walletClient } = useConnectorClient(wagmiConfig);
  const form = useForm<FarcasterAccountSetupFormValues>({
    resolver: zodResolver(FarcasterAccountSetupFormSchema),
    defaultValues: { username: "hellyes" },
  });
  const { accounts } = useAccountStore();
  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.active &&
      account.platform === AccountPlatformType.farcaster &&
      account.name === PENDING_ACCOUNT_NAME_PLACEHOLDER
  );
  console.log("pendingAccounts", pendingAccounts);

  const fid = pendingAccounts[0]?.platformAccountId;
  const canSubmitForm = !isPending && isConnected && fid;

  useEffect(() => {
    if (pendingAccounts.length === 0) {
      setError("No pending accounts found");
    } else if (pendingAccounts.length > 1) {
      setError("Multiple pending accounts found");
    } else if (!fid) {
      setError("No FID found");
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

    setIsPending(true);

    console.log("createFarcasterAccount", data);

    // const hexStringPublicKey: `0x${string}` = pendingAccounts[0].publicKey;
    // const hexStringPrivateKey: `0x${string}` = pendingAccounts[0].privateKey!;
    const timestamp = Math.floor(Date.now() / 1000);
    // console.log("walletClient", walletClient.data);
    // const userSigner = new ViemWalletEip712Signer({
    //   ...walletClient!,
    // });
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
    // const signature = toHex(rawSignature._unsafeUnwrap());

    // updateUsername(fid, data.username, address, signature);
  };

  const renderForm = () => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(registerFarcasterUsername)}
        className="space-y-8"
      >
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username for account fid: {fid}</FormLabel>
              <FormControl>
                <Input placeholder="hellyes" {...field} />
              </FormControl>
              <FormDescription>
                This will be your public username on Farcaster. It can be your
                real name or a pseudonym.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant={canSubmitForm ? "default" : "outline"} type="submit">
          Register username
        </Button>
        {/* <Button
        className="ml-4"
          variant="outline"
          onClick={() => onSuccess(form.getValues())}
        >
          Skip
        </Button> */}
      </form>
    </Form>
  );

  return (
    <div className="w-1/2">
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
