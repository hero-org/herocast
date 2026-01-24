'use client';

import '@farcaster/auth-kit/styles.css';
import React, { useEffect, useState, Suspense } from 'react';
import { UserAuthForm } from '@/common/components/UserAuthForm';
import { AuthKitProvider } from '@farcaster/auth-kit';
import { useSearchParams, useRouter } from 'next/navigation';

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useAuth } from '@/common/context/AuthContext';
import { Loading } from '@/common/components/Loading';

const authKitConfig = {
  rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  domain: 'app.herocast.xyz',
  // siweUri: `${process.env.NEXT_PUBLIC_URL}/api/auth/siwe`,
};

function AuthFormSkeleton() {
  return <div className="h-[380px] w-full animate-pulse rounded-lg bg-muted/40" />;
}

function getSafeRedirect(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/login')) return null;
  return path;
}

function LoggingInMessage() {
  return (
    <div className="h-[380px] w-full flex flex-col items-center justify-center gap-3">
      <Loading />
      <p className="text-sm text-muted-foreground">Logging you in...</p>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, didLoad } = useAuth();
  const signupOnly = searchParams.get('signupOnly');
  const view = searchParams.get('view');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');
  const redirectParam = searchParams.get('redirect');
  const safeRedirect = getSafeRedirect(redirectParam);
  const showOnlySignup = signupOnly === 'true' || view === 'reset';
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (error && error_description) {
      setErrorMessage(decodeURIComponent(error_description as string));
    }
  }, [error, error_description]);

  // Redirect logged-in users to /feeds or /post
  useEffect(() => {
    if (didLoad && user && view !== 'reset') {
      router.replace(safeRedirect || '/feeds');
    }
  }, [didLoad, user, view, router, safeRedirect]);

  const renderAuthForm = () => {
    // Show skeleton while auth state is loading
    if (!didLoad) {
      return <AuthFormSkeleton />;
    }

    // If logged in and not resetting password, show logging in message while redirect happens
    if (user && view !== 'reset') {
      return <LoggingInMessage />;
    }

    // Show the actual form
    return (
      <div className="text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
        <UserAuthForm signupOnly={showOnlySignup} />
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen">
      <div className="w-full h-screen lg:grid lg:grid-cols-2 lg:justify-between">
        <div className="flex lg:align-top items-start mt-20 justify-center py-12 px-4">
          <AuthKitProvider config={authKitConfig}>
            <Card className="mx-4 w-full max-w-md sm:mx-auto">
              <CardContent className="mt-6">
                {errorMessage && (
                  <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
                {renderAuthForm()}
              </CardContent>
            </Card>
          </AuthKitProvider>
        </div>
        <div className="hidden bg-foreground/90 dark:bg-muted/40 w-full lg:ml-auto lg:flex h-full place-self-end">
          <img
            src="/images/hero_new.png"
            alt="herocast-app-screenshot"
            width="805"
            height="848"
            style={{ objectPosition: 'left' }}
            className="h-full w-full object-cover dark:brightness-[0.8]"
          />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="w-full min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
