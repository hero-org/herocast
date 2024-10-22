import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from './Loading';
import { SignInButton, useProfile } from '@farcaster/auth-kit';
import { useEffect, useState } from 'react';
import { createClient } from '../helpers/supabase/component';
import { useRouter } from 'next/router';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePostHog } from 'posthog-js/react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAccountStore } from '@/stores/useAccountStore';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { AccountPlatformType, AccountStatusType } from '../constants/accounts';
import { useHotkeys } from 'react-hotkeys-hook';
import { Key } from 'ts-key-enum';
import includes from 'lodash.includes';
import { User } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

export type UserAuthFormValues = z.infer<typeof UserAuthFormSchema>;

const UserAuthFormSchema = z.object({
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  password: z.string().min(6, {
    message: 'Password must be at least 8 characters.',
  }),
});

enum ViewState {
  LOGIN = 'login',
  SIGNUP = 'signup',
  FORGOT = 'forgot',
  RESET = 'reset',
  LOGGED_IN = 'logged_in',
}

export function UserAuthForm({ signupOnly }: { signupOnly: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const posthog = usePostHog();
  const {
    isAuthenticated,
    profile: { username, fid },
  } = useProfile();
  const { accounts, addAccount, resetStore } = useAccountStore();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>('');
  const [view, setView] = useState<ViewState>(ViewState.SIGNUP);
  const { user } = useAuth();
  const hasSignInWithFarcaster = false;

  const form = useForm<UserAuthFormValues>({
    resolver: zodResolver(UserAuthFormSchema),
    mode: 'onSubmit',
  });

  const { isValid } = form.formState;

  async function signUp() {
    if (!(await form.trigger())) return;

    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message === 'User already registered') {
        logInWithEmail();
      } else {
        form.setError('password', {
          type: 'manual',
          message: error.message,
        });
        console.error('signup error', error);
        setIsLoading(false);
      }

      return;
    } else {
      posthog.identify(data?.user?.id, { email });
      setUserMessage('Welcome to the herocast experience!');
      router.push('/welcome/new');
      setIsLoading(false);
    }
  }

  const resetPassword = async () => {
    const { email } = form.getValues();

    if (!email) {
      form.setError('email', {
        type: 'manual',
        message: 'Email is required.',
      });
      return;
    }

    setIsLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/login`,
    });
    setUserMessage('Sent password reset email to you');
    setView(ViewState.LOGIN);
    setIsLoading(false);
  };

  const submitNewPassword = async () => {
    form.clearErrors();
    const { email, password } = form.getValues();

    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      setUserMessage('There was an error updating your password.');
      form.setError('password', {
        type: 'manual',
        message: error.message,
      });
      return;
    }
    if (data?.user) {
      setUserMessage('Success! Logging you in...');
      posthog.identify(data?.user?.id, { email });
      router.push('/post');
      setIsLoading(false);
    } else {
      setUserMessage('Something went wrong. Please try again.');
      return;
    }
  };

  const logInWithEmail = async () => {
    if (!(await form.trigger())) return;

    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      form.setError('password', {
        type: 'manual',
        message: error.message,
      });
      console.error('login error', error);
      setIsLoading(false);
      return;
    }

    posthog.identify(data?.user?.id, { email });
    router.push('/post');
  };

  const loginWithGoogle = async () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
    });
  };

  const getButtonAction = () => {
    switch (view) {
      case ViewState.FORGOT:
        return resetPassword;
      case ViewState.LOGIN:
        return logInWithEmail;
      case ViewState.SIGNUP:
        return signUp;
      case ViewState.RESET:
        return submitNewPassword;
      case ViewState.LOGGED_IN:
        return () => router.push('/post');
      default:
        return () => {};
    }
  };

  const buttonAction = getButtonAction();
  useHotkeys(Key.Enter, buttonAction, [form.getValues()], {
    enableOnFormTags: true,
  });

  useEffect(() => {
    if (router.query?.view) {
      setView(router.query.view as ViewState);
    }

    if (user && router.query?.view !== ViewState.RESET) {
      setView(ViewState.LOGGED_IN);
    }
  }, [router.query?.view, user]);

  useEffect(() => {
    if (isAuthenticated && username && fid) {
      setupLocalAccount({ fid, username });
    }
  }, [isAuthenticated, username, fid]);

  const localAccounts = accounts.filter((account) => account.platform === AccountPlatformType.farcaster_local_readonly);

  const setupLocalAccount = async ({ fid, username }) => {
    if (!fid || !username) return;

    const hasLocalAccountCreated = localAccounts.some((a) => a.platformAccountId === fid.toString());
    setIsLoading(true);
    let account;
    if (hasLocalAccountCreated) {
      account = localAccounts.find((a) => a.platformAccountId === fid.toString());
    } else {
      setUserMessage('Setting up local account...');
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

      const users = (await neynarClient.fetchBulkUsers([fid], { viewerFid: APP_FID })).users;
      if (!users.length) {
        console.error('No users found for fid: ', fid);
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

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      setUserMessage('Error setting up local account.');
      setIsLoading(false);
      return;
    }

    posthog.identify(data?.user?.id, { isLocalOnly: true });
    setUserMessage('Setup done. Welcome to the herocast experience!');
    router.push('/post');
    setIsLoading(false);
  };

  const renderSubmitButton = () => {
    let buttonText = '';

    switch (view) {
      case ViewState.FORGOT:
        buttonText = 'Reset Password';
        break;
      case ViewState.LOGIN:
        buttonText = 'Continue';
        break;
      case ViewState.SIGNUP:
        buttonText = 'Sign Up';
        break;
      case ViewState.RESET:
        buttonText = 'Set New Password';
        break;
      case ViewState.LOGGED_IN:
        buttonText = 'Continue';
        break;
    }

    const buttonMustBeValid = includes([ViewState.SIGNUP, ViewState.LOGIN], view);
    return (
      <Button
        type="button"
        size="lg"
        className="text-white text-base py-6 bg-gradient-to-r from-[#8A63D2] to-[#ff4eed] hover:from-[#6A4CA5] hover:to-[#c13ab3]"
        disabled={isLoading || (buttonMustBeValid && !isValid)}
        onClick={() => buttonAction()}
      >
        {isLoading ? <Loading className="text-white" /> : buttonText}
      </Button>
    );
  };

  const renderViewSwitchText = () => {
    switch (view) {
      case ViewState.LOGIN:
        return (
          <div className="mt-2 text-center text-sm hover:cursor-pointer" onClick={() => setView(ViewState.SIGNUP)}>
            No herocast account? <span className="underline">Sign up</span>
          </div>
        );
      case ViewState.FORGOT:
      case ViewState.SIGNUP:
        return (
          <div className="mt-2 text-center text-sm hover:cursor-pointer" onClick={() => setView(ViewState.LOGIN)}>
            Already have your herocast account? <span className="underline">Log in</span>
          </div>
        );
    }
  };

  const logOut = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      resetStore();
      await supabase.auth.signOut();
      posthog.reset();
      setView(ViewState.LOGIN);
    }
  };

  const renderViewHelpText = () => {
    switch (view) {
      case ViewState.FORGOT:
        return 'Forgot your password? Enter your email below to reset it';
      case ViewState.RESET:
        return 'Enter your new password';
      case ViewState.SIGNUP:
        return 'Create your herocast account';
      case ViewState.LOGGED_IN:
        return `You are logged in as ${user?.email}`;
      default:
        return 'Login to your herocast account';
    }
  };

  const renderGoogleLoginButton = () => (
    <Button type="button" size="lg" variant="outline" className="py-4" onClick={() => loginWithGoogle()}>
      <img src="/images/google_logo.png" alt="google logo" width="24" height="24" className="" />
      Login with Google
    </Button>
  );

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <span className="text-2xl font-semibold tracking-tight">{renderViewHelpText()}</span>

        <form>
          <div className="flex">
            {userMessage && <span className="text-md text-muted-foreground">{userMessage}</span>}
          </div>
          <div className="grid gap-4">
            {view !== ViewState.LOGGED_IN && (
              <div className="grid gap-4">
                {renderGoogleLoginButton()}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          variantSize="lg"
                          type="email"
                          placeholder="vitalik@ethereum.org"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!includes([ViewState.FORGOT, ViewState.LOGGED_IN], view) && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            variantSize="lg"
                            disabled={isLoading}
                            autoComplete="current-password"
                            type="password"
                            placeholder="••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
            {renderSubmitButton()}
            {view === ViewState.LOGIN && (
              <Button
                type="button"
                variant="outline"
                className="w-full shadow-none rounded-lg"
                disabled={isLoading}
                onClick={() => setView(ViewState.FORGOT)}
              >
                Forgot Password?
              </Button>
            )}
            {view === ViewState.LOGGED_IN && (
              <Button
                type="button"
                variant="outline"
                className="w-full shadow-none rounded-lg"
                disabled={isLoading}
                onClick={() => logOut()}
              >
                Not you? Log out
              </Button>
            )}
            {renderViewSwitchText()}
          </div>
        </form>
      </Form>
      {hasSignInWithFarcaster && !signupOnly && view !== ViewState.LOGGED_IN && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <div className="flex flex-col space-y-4 items-center justify-center text-white">
            {!isAuthenticated ? (
              <>
                <SignInButton hideSignOut />
                <span className="text-center text-sm text-foreground">Sign in with Farcaster for read-only access</span>
              </>
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
        </>
      )}
    </div>
  );
}
