import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';
import { Key } from 'ts-key-enum';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAccountStore } from '@/stores/useAccountStore';
import { useAuth } from '../context/AuthContext';
import { createClient } from '../helpers/supabase/component';

export type UserAuthFormValues = z.infer<typeof UserAuthFormSchema>;

const UserAuthFormSchema = z
  .object({
    email: z.string().email({
      message: 'Please enter a valid email address.',
    }),
    password: z.string().min(6, {
      message: 'Password must be at least 8 characters.',
    }),
    confirmPassword: z
      .string()
      .min(6, {
        message: 'Confirm Password must be at least 8 characters.',
      })
      .optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
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
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>('');
  const [view, setView] = useState<ViewState>(ViewState.SIGNUP);
  const { user } = useAuth();
  const { resetStore } = useAccountStore();

  const form = useForm<UserAuthFormValues>({
    resolver: zodResolver(UserAuthFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
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
    const viewParam = searchParams.get('view');
    if (viewParam) {
      setView(viewParam as ViewState);
    }

    if (user && viewParam !== ViewState.RESET) {
      setView(ViewState.LOGGED_IN);
    }
  }, [searchParams, user]);

  const renderSubmitButton = () => {
    let buttonText = '';

    switch (view) {
      case ViewState.FORGOT:
        buttonText = 'Reset password';
        break;
      case ViewState.LOGIN:
        buttonText = 'Login';
        break;
      case ViewState.SIGNUP:
        buttonText = 'Sign up';
        break;
      case ViewState.RESET:
        buttonText = 'Set password';
        break;
      case ViewState.LOGGED_IN:
        buttonText = 'Continue';
        break;
    }

    const buttonMustBeValid = [ViewState.SIGNUP, ViewState.LOGIN].includes(view);
    return (
      <Button
        type="button"
        className="w-full"
        disabled={isLoading || (buttonMustBeValid && !isValid)}
        onClick={() => buttonAction()}
      >
        {isLoading ? <Spinner className="h-4 w-4" /> : buttonText}
      </Button>
    );
  };

  const logOut = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      // Sync notifications before logout
      try {
        const { useNotificationStore } = await import('@/stores/useNotificationStore');
        const notificationStore = useNotificationStore.getState();
        if (notificationStore.syncQueue.length > 0) {
          console.log('Syncing notifications before logout...');
          await notificationStore.syncToSupabase();
        }
      } catch (error) {
        console.error('Error syncing notifications on logout:', error);
      }

      resetStore();
      await supabase.auth.signOut();
      posthog.reset();
      setView(ViewState.LOGIN);
    }
  };

  const renderViewHelpText = () => {
    switch (view) {
      case ViewState.FORGOT:
        return 'forgot your password? Enter your email below to reset it';
      case ViewState.RESET:
        return 'enter your new password';
      case ViewState.SIGNUP:
        return 'create your herocast account';
      case ViewState.LOGGED_IN:
        return `welcome back to herocast`;
      default:
        return 'login to herocast';
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case ViewState.SIGNUP:
        return 'Sign up with your Google account or email';
      case ViewState.LOGIN:
        return 'Login with your Google account or email';
      case ViewState.FORGOT:
        return 'Enter your email to reset your password';
      case ViewState.RESET:
        return 'Choose a new password for your account';
      case ViewState.LOGGED_IN:
        return 'You are already signed in';
      default:
        return '';
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{renderViewHelpText()}</h1>
        <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
      </div>

      {userMessage && <p className="text-sm text-center text-muted-foreground">{userMessage}</p>}

      {view !== ViewState.LOGGED_IN && (
        <>
          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => loginWithGoogle()}
            disabled={isLoading}
          >
            <img src="/images/google_logo.png" alt="" width={20} height={20} />
            Login with Google
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
        </>
      )}

      {/* Email form */}
      <Form {...form}>
        <form className="grid gap-4">
          {view !== ViewState.LOGGED_IN && (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="m@example.com" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {![ViewState.FORGOT, ViewState.LOGGED_IN].includes(view) && (
                <>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          {view === ViewState.LOGIN && (
                            <button
                              type="button"
                              className="text-sm underline-offset-4 hover:underline text-muted-foreground"
                              onClick={() => setView(ViewState.FORGOT)}
                            >
                              Forgot your password?
                            </button>
                          )}
                        </div>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            disabled={isLoading}
                            autoComplete={view === ViewState.SIGNUP ? 'new-password' : 'current-password'}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {view === ViewState.RESET && (
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              disabled={isLoading}
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </>
          )}

          {renderSubmitButton()}

          {view === ViewState.LOGGED_IN && (
            <Button type="button" variant="outline" className="w-full" disabled={isLoading} onClick={() => logOut()}>
              Not you? Log out
            </Button>
          )}
        </form>
      </Form>

      {/* View switch */}
      {view === ViewState.LOGIN && (
        <div className="text-center text-sm">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-primary"
            onClick={() => setView(ViewState.SIGNUP)}
          >
            Sign up
          </button>
        </div>
      )}
      {(view === ViewState.SIGNUP || view === ViewState.FORGOT) && (
        <div className="text-center text-sm">
          Already have an account?{' '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-primary"
            onClick={() => setView(ViewState.LOGIN)}
          >
            Login
          </button>
        </div>
      )}
    </div>
  );
}
