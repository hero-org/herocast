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
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { UserDataType } from "@farcaster/hub-web";
import { setUserDataInProtocol } from "@/common/helpers/farcaster";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import {
  Cog6ToothIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { optimism } from "viem/chains";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Textarea } from "@/components/ui/textarea";

export type ChangeBioFormValues = z.infer<typeof ChangeBioFormSchema>;

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const ChangeBioFormSchema = z.object({
  bio: z.string().max(128, {
    message: "Username must not be longer than 30 characters.",
  }),
});

const ChangeBioForm = ({
  account,
  onSuccess,
}: {
  onSuccess?: (data: ChangeBioFormValues) => void;
  account: AccountObjectType;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [userInProtocol, setUserInProtocol] = useState<User>();
  const { address, chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const client = useWalletClient({
    account: address,
    chainId: optimism.id,
  })?.data;

  const form = useForm<ChangeBioFormValues>({
    resolver: zodResolver(ChangeBioFormSchema),
    mode: "onSubmit",
  });
  const canSubmitForm = !isPending && isConnected && chainId === optimism.id;

  useEffect(() => {
    const getUserInProtocol = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (
        await neynarClient.fetchBulkUsers(
          [Number(account.platformAccountId!)],
          { viewerFid: APP_FID! }
        )
      ).users[0];
      console.log('user', user)
      if (user) {
        setUserInProtocol(user);
      }
    };

    if (account.platformAccountId) {
      getUserInProtocol();
    }
  }, [account.platformAccountId]);

  const changeBio = async (data) => {
    if (!address || !client || !userInProtocol) return;

    const { bio } = data;
    setIsPending(true);

    try {
      await setUserDataInProtocol(
        account.privateKey!,
        Number(account.platformAccountId!),
        UserDataType.BIO,
        bio
      );
    } catch (e) {
      console.error("ChangeBio error", e);
      form.setError("bio", {
        type: "manual",
        message: `Error setting bio -> ${e}`,
      });
    } finally {
      setIsPending(false);
    }
  };

  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(changeBio)} className="space-y-4">
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New bio</FormLabel>
              <FormControl>
                <Textarea
                  defaultValue={userInProtocol?.profile?.bio?.text}
                  placeholder="Your new bio..."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                This will be your new public bio on Farcaster.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
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
          <p>Update bio</p>
        </Button>
        {chainId !== optimism.id && (
          <Button
            type="button"
            variant="default"
            className="ml-4"
            onClick={() => switchChain({ chainId: optimism.id })}
          >
            Switch to Optimism
          </Button>
        )}
      </form>
    </Form>
  );

  return (
    <div className="flex flex-col gap-y-4">
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

export default ChangeBioForm;
