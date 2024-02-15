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
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import {
  BUNDLER_ADDRESS,
  ViemWalletEip712Signer,
  bundlerABI,
  bytesToHexString,
} from "@farcaster/hub-web";
import { config, publicClient } from "@/common/helpers/rainbowkit";
import {
  WARPCAST_RECOVERY_PROXY,
  getDeadline,
  getSignedKeyRequestMetadataFromAppAccount,
  readNoncesFromKeyGateway,
  validateUsernameIsAvailable,
} from "../helpers/farcaster";
import { toBytes, toHex } from "viem";
import { useAccountStore } from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { generateKeyPair } from "../helpers/warpcastLogin";
import { writeContract } from "@wagmi/core";
import ShowLinkCard from "./ShowLinkCard";
import debounce from "lodash.debounce";

export type FarcasterAccountSetupFormValues = z.infer<
  typeof FarcasterAccountSetupFormSchema
>;

const FarcasterAccountSetupFormSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 1 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
    displayName: z.string().min(5, {
      message: "Display name must be at least 5 characters",
    }),
    bio: z.string().max(160).min(4),
});

const CreateFarcasterAccountForm = ({
  onSuccess,
}: {
  onSuccess: (data: FarcasterAccountSetupFormValues) => void;
}) => {
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>("0x");
  const [isPending, setIsPending] = useState(false);

  const { address, isConnected } = useAccount();
  const wallet = useWalletClient();
  const form = useForm<FarcasterAccountSetupFormValues>({
    resolver: zodResolver(FarcasterAccountSetupFormSchema),
    defaultValues: { username: "hellyes" },
    mode: "onChange",
    // validate: () => null,
  });
  const username = useWatch({ name: "username", control: form.control });
  const canSubmitForm = !isPending && isConnected;
  const { accounts, addAccount, setAccountActive } = useAccountStore();

  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster
  );

  const transactionResult = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useEffect(() => {
    if (transactionHash === "0x") return;

    console.log("onchainTransactionHash", transactionHash);
    if (transactionResult) {
      console.log("transactionResult", transactionResult);
      // todo: get the fid from the transaction result
      // setAccountActive(pendingAccounts[0].id);
    }
  }, [transactionHash, transactionResult]);

  useEffect(() => {
    const checkIfUsernameIsAvailable = async () => {
      // console.log('useEffect checkIfUsernameIsAvailable', username);
      const isValid = await validateUsernameIsAvailable(username);
      if (!isValid) {
        // this setting form error doesn't work for some reason
        form.setError("username", {
          type: "manual",
          message: `Username ${username} is already taken`,
        });
      }
    }

    checkIfUsernameIsAvailable();
  }, [username]);

  const createFarcasterAccount = async (data) => {
    if (!address) return;

    setIsPending(true);
    
    const isValidNewUsername = await validateUsernameIsAvailable(data.username);
    if (!isValidNewUsername) {
      form.setError("username", {
        type: "manual",
        message: "Username is already taken",
      });
      setIsPending(false);
      return;
    }
    
    console.log("createFarcasterAccount", data);
    let hexStringPublicKey: `0x${string}`, hexStringPrivateKey: `0x${string}`;

    if (!pendingAccounts || pendingAccounts.length === 0) {
      const { publicKey, privateKey } = await generateKeyPair();
      hexStringPublicKey = bytesToHexString(publicKey)._unsafeUnwrap();
      hexStringPrivateKey = bytesToHexString(privateKey)._unsafeUnwrap();

      try {
        addAccount({
          id: null,
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster_hats_protocol,
          publicKey: hexStringPublicKey,
          privateKey: hexStringPrivateKey,
        });
      } catch (e) {
        console.log("error when trying to add account", e);
        setIsPending(false);
        return;
      }
    } else {
      hexStringPublicKey = pendingAccounts[0].publicKey;
      hexStringPrivateKey = pendingAccounts[0].privateKey!;
    }

    const nonce = await readNoncesFromKeyGateway(address!);
    const deadline = getDeadline();
    const userSigner = new ViemWalletEip712Signer(wallet.data);
    const registerSignatureResponse = await userSigner.signRegister({
      to: address,
      recovery: WARPCAST_RECOVERY_PROXY,
      nonce,
      deadline,
    });
    if (registerSignatureResponse.isErr()) {
      console.log(
        "error when trying to sign register",
        registerSignatureResponse
      );
      setIsPending(false);
      return;
    }
    const registerSignature = toHex(registerSignatureResponse.value);

    const metadata = await getSignedKeyRequestMetadataFromAppAccount(
      hexStringPublicKey,
      deadline
    );

    const addSignatureResponse = await userSigner.signAdd({
      owner: address,
      keyType: 1,
      key: toBytes(hexStringPublicKey),
      metadataType: 1,
      metadata,
      nonce,
      deadline,
    });

    if (addSignatureResponse.isErr()) {
      console.log("error when trying to sign add", addSignatureResponse);
      setIsPending(false);
      return;
    }
    const addSignature = toHex(addSignatureResponse.value);

    const price = await publicClient.readContract({
      address: BUNDLER_ADDRESS,
      abi: bundlerABI,
      functionName: "price",
      args: [0n],
    });
    try {
      const tx = await writeContract(config, {
        address: BUNDLER_ADDRESS,
        abi: bundlerABI,
        functionName: "register",
        args: [
          {
            to: address,
            recovery: WARPCAST_RECOVERY_PROXY,
            sig: registerSignature,
            deadline,
          },
          [
            {
              keyType: 1,
              key: hexStringPublicKey,
              metadataType: 1,
              metadata: metadata,
              sig: addSignature,
              deadline,
            },
          ],
          0n,
        ],
        value: price,
      });
      setTransactionHash(tx);
    } catch (e) {
      console.log("error when trying to write contract", e);
      setIsPending(false);
      return;
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(createFarcasterAccount)}
        className="space-y-8"
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
                This will be your public username on Farcaster. It can be your
                real name or a pseudonym.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us a little bit about yourself"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                You can <span>@mention</span> other users and organizations to
                link to them.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        /> */}
        <Button
          variant={canSubmitForm ? "default" : "outline"}
          disabled={!canSubmitForm}
          type="submit"
        >
          Create account
        </Button>
      </form>
    </Form>
  );

  return (
    <>
      {renderForm()}
      {transactionHash !== "0x" && (
        <ShowLinkCard
          title="See your transaction"
          description="View on Optimism Etherscan"
          link={`https://optimistic.etherscan.io/tx/${transactionHash}`}
          buttonLabel="Open"
        />
      )}
    </>
  );
};

export default CreateFarcasterAccountForm;
