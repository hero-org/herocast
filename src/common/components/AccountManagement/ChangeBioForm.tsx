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
import { UserDataType } from "@farcaster/hub-web";
import { setUserDataInProtocol } from "@/common/helpers/farcaster";
import { AccountObjectType } from "@/stores/useAccountStore";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type ChangeBioFormValues = z.infer<typeof ChangeBioFormSchema>;

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const ChangeBioFormSchema = z.object({
  bio: z.string().max(256, {
    message: "Bio must not be longer than 256 characters.",
  }),
});

type ChangeBioFormProps = {
  account: AccountObjectType;
  onSuccess?: () => void;
};

const ChangeBioForm = ({ account, onSuccess }: ChangeBioFormProps) => {
  const [isPending, setIsPending] = useState(false);
  const [userInProtocol, setUserInProtocol] = useState<User>();

  const form = useForm<ChangeBioFormValues>({
    resolver: zodResolver(ChangeBioFormSchema),
    mode: "onSubmit",
  });
  const canSubmitForm = !isPending && userInProtocol;

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
      if (user) {
        setUserInProtocol(user);
      }
    };

    if (account.platformAccountId) {
      getUserInProtocol();
    }
  }, [account.platformAccountId]);

  const changeBio = async (data) => {
    if (!userInProtocol) return;

    const { bio } = data;

    if (bio === userInProtocol?.profile?.bio?.text) {
      form.setError("bio", {
        type: "manual",
        message: "Please enter a new bio.",
      });
      return;
    }

    setIsPending(true);

    try {
      await setUserDataInProtocol(
        account.privateKey!,
        Number(account.platformAccountId!),
        UserDataType.BIO,
        bio
      );
      toast.success("Bio changed successfully", {
        duration: 5000,
        closeButton: true,
      });
      onSuccess?.();
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
      </form>
    </Form>
  );

  return <div className="flex flex-col gap-y-4">{renderForm()}</div>;
};

export default ChangeBioForm;
