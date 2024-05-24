import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "./Loading";
import { SignInButton, useProfile } from "@farcaster/auth-kit";
import { useState } from "react";
import { createClient } from "../helpers/supabase/component";
import { useRouter } from "next/router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { usePostHog } from "posthog-js/react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  hydrate,
  hydrateChannels,
  useAccountStore,
} from "@/stores/useAccountStore";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { v4 as uuidv4 } from "uuid";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

export type UserAuthFormValues = z.infer<typeof UserAuthFormSchema>;

const UserAuthFormSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 8 characters.",
  }),
});

export function UserAuthForm({
  signupOnly,
  className,
}: {
  signupOnly: boolean;
  className: string;
}) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>("");
  const supabase = createClient();
  const router = useRouter();
  const posthog = usePostHog();
  const {
    isAuthenticated,
    profile: { username, fid },
  } = useProfile();

  const { accounts, addAccount } = useAccountStore();

  React.useEffect(() => {
    if (isAuthenticated && username && fid) {
      setupLocalAccount({ fid, username });
    }
  }, [isAuthenticated, username, fid]);

  const localAccounts = accounts.filter(
    (account) =>
      account.platform === AccountPlatformType.farcaster_local_readonly
  );

  const form = useForm<UserAuthFormValues>({
    resolver: zodResolver(UserAuthFormSchema),
    mode: "onSubmit",
  });

  const setupLocalAccount = async ({ fid, username }) => {
    if (!fid || !username) return;

    const hasLocalAccountCreated = localAccounts.some((a) => a.platformAccountId === fid.toString());
    setIsLoading(true);
    let account;
    if (hasLocalAccountCreated) {
      account = localAccounts.find((a) => a.platformAccountId === fid.toString());
    } else {
      setUserMessage("Setting up local account...");
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
  
      const users = (
        await neynarClient.fetchBulkUsers([fid], { viewerFid: APP_FID })
      ).users;
      if (!users.length) {
        console.error("No users found for fid: ", fid);
        return;
      }
  
      account = {
        name: username,
        status: AccountStatusType.active,
        platform: AccountPlatformType.farcaster_local_readonly,
        platformAccountId: fid.toString(),
        user: users?.[0],
      };
      await addAccount({
        account,
        localOnly: true,
      });
    }

    await hydrateChannels();
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      setUserMessage("Error setting up local account.");
      setIsLoading(false);
      return;
    }

    posthog.identify(data?.user?.id, { isLocalOnly: true });
    setUserMessage("Setup done. Welcome to the herocast experience!");
    router.push("/welcome");
    setIsLoading(false);
  };

  async function logIn() {
    if (!(await form.trigger())) return;

    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      form.setError("password", {
        type: "manual",
        message: error.message,
      });
      console.error("login error", error);
      setIsLoading(false);
      return;
    }

    posthog.identify(data?.user?.id, { email });
    await hydrate();
    router.push("/feed");
    setIsLoading(false);
  }

  async function signUp() {
    if (!(await form.trigger())) return;

    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_URL}/api/auth/confirm?type=signup&next=/welcome`,
      },
    });
    console.log(data, error);

    if (error) {
      form.setError("password", {
        type: "manual",
        message: error.message,
      });
      console.error("signup error", error);
      setIsLoading(false);
      return;
    } else {
      posthog.identify(data?.user?.id, { email });
      setUserMessage("Account created. Please check your email to continue");
      setIsLoading(false);
    }
  }

  async function resetPassword() {
    const { email } = form.getValues();
    if (!email) {
      form.setError("email", {
        type: "manual",
        message: "Email is required.",
      });
      return;
    }

    setIsLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/login`,
    });
    setUserMessage("Password reset email sent.");
    setIsLoading(false);
  }

  useHotkeys(Key.Enter, logIn, [form.getValues()], { enableOnFormTags: true });

  return (
    <div className={cn("grid gap-6", className)}>
      <div className="flex justify-center text-center">
        {userMessage && (
          <Label className="w-2/3 text-md text-gray-100">{userMessage}</Label>
        )}
      </div>
      <Form {...form}>
        <form>
          <div className="grid gap-4">
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-200">Email</FormLabel>
                    <FormControl>
                      <Input
                        className="text-white"
                        placeholder="vitalik@ethereum.org"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-200">Password</FormLabel>
                    <FormControl>
                      <Input
                        className="text-white"
                        placeholder="************"
                        disabled={isLoading}
                        autoComplete="current-password"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="button"
              size="lg"
              className="text-white text-base py-6 bg-gradient-to-r from-[#8A63D2] to-[#ff4eed] hover:from-[#6A4CA5] hover:to-[#c13ab3]"
              disabled={isLoading}
              onClick={() => logIn()}
            >
              {isLoading ? <Loading /> : "Sign In with Email"}
            </Button>
            <div className="flex items-center justify-center space-x-2">
              <Button
                type="button"
                variant="outline"
                className="text-gray-100 border-gray-500 w-full"
                disabled={isLoading}
                onClick={() => signUp()}
              >
                Signup
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-gray-100 border-gray-500 w-full"
                disabled={isLoading}
                onClick={() => resetPassword()}
              >
                Forgot Password?
              </Button>
            </div>
          </div>
        </form>
      </Form>
      {signupOnly ? (
        <Button variant="default" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-5 w-5 mr-2" /> Back to using read-only
          account
        </Button>
      ) : (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-900 px-2 text-muted">
              or continue with
            </span>
          </div>
        </div>
      )}
      {!signupOnly && (
        <div className="flex flex-col space-y-4 items-center justify-center text-white">
          {!isAuthenticated ? (
            <SignInButton hideSignOut />
          ) : (
            <Button
              type="button"
              size="lg"
              className="py-4 text-white bg-[#8A63D2] hover:bg-[#6A4CA5] rounded-md"
              disabled
            >
              Signed in with Farcaster ☑️
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
