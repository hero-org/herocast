import '@farcaster/auth-kit/styles.css';
import React, { useEffect, useState } from 'react';
import { UserAuthForm } from '@/common/components/UserAuthForm';
import { AuthKitProvider } from '@farcaster/auth-kit';
import { useRouter } from 'next/router';

import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

const authKitConfig = {
  rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  domain: 'app.herocast.xyz',
  // siweUri: `${process.env.NEXT_PUBLIC_URL}/api/auth/siwe`,
};

export default function Login() {
  const router = useRouter();
  const { signupOnly, view, error, error_description } = router.query;
  const showOnlySignup = signupOnly === 'true' || view === 'reset';
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (error && error_description) {
      setErrorMessage(decodeURIComponent(error_description as string));
    }
  }, [error, error_description]);

  const renderAuthForm = () => (
    <div className="text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
      <UserAuthForm signupOnly={showOnlySignup} />
    </div>
  );

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
